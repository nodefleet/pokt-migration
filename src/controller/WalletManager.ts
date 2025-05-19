import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { SigningStargateClient, StargateClient, IndexedTx } from "@cosmjs/stargate";
import { Tx } from "cosmjs-types/cosmos/tx/v1beta1/tx.js";
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx.js";
import { NETWORKS } from "./config";

export interface Transaction {
    hash: string;
    from: string;
    to: string;
    value: string;
    timestamp: number;
    status: 'pending' | 'confirmed' | 'failed';
    type: 'send' | 'recv';
    height: number;
}

export class WalletManager {
    private client: StargateClient | null = null;
    private signingClient: SigningStargateClient | null = null;
    private wallet: DirectSecp256k1HdWallet | null = null;
    private isTestnet: boolean = true;

    constructor(rpcUrl: string) {
        this.initializeClient(rpcUrl);
    }

    private async initializeClient(rpcUrl: string) {
        this.client = await StargateClient.connect(rpcUrl);
    }

    /**
     * Cambia entre testnet y mainnet
     * @param useTestnet - true para usar testnet, false para mainnet
     */
    async switchNetwork(useTestnet: boolean): Promise<void> {
        this.isTestnet = useTestnet;
        const rpcUrl = useTestnet ? NETWORKS.TESTNET.rpcUrl : NETWORKS.MAINNET.rpcUrl;
        await this.initializeClient(rpcUrl);

        if (this.wallet) {
            this.signingClient = await SigningStargateClient.connectWithSigner(
                rpcUrl,
                this.wallet
            );
        }
    }

    /**
     * Obtiene la red actual
     * @returns {boolean} true si es testnet, false si es mainnet
     */
    isTestnetNetwork(): boolean {
        return this.isTestnet;
    }

    /**
     * Obtiene la configuración de la red actual
     */
    getCurrentNetwork() {
        return this.isTestnet ? NETWORKS.TESTNET : NETWORKS.MAINNET;
    }

    /**
     * Crea una nueva wallet
     * @param password - Contraseña para encriptar la wallet
     * @returns {Promise<{address: string, serializedWallet: string}>} La dirección y la wallet serializada
     */
    async createWallet(password: string): Promise<{ address: string; serializedWallet: string }> {
        this.wallet = await DirectSecp256k1HdWallet.generate(24, { prefix: "pokt" });
        const [firstAccount] = await this.wallet.getAccounts();
        const serializedWallet = await this.wallet.serialize(password);
        return {
            address: firstAccount.address,
            serializedWallet
        };
    }

    /**
     * Importa una wallet existente usando una wallet serializada
     * @param serialization - La wallet serializada
     * @param password - Contraseña para desencriptar la wallet
     * @returns {Promise<string>} La dirección de la wallet importada
     */
    async importWallet(serialization: string, password: string): Promise<string> {
        this.wallet = await DirectSecp256k1HdWallet.deserialize(serialization, password);
        const [firstAccount] = await this.wallet.getAccounts();
        return firstAccount.address;
    }

    /**
     * Obtiene el balance de la wallet
     * @param address - La dirección de la wallet
     * @returns {Promise<string>} El balance en upokt
     */
    async getBalance(address: string): Promise<string> {
        if (!this.client) throw new Error('Cliente no inicializado');
        const result = await this.client.getBalance(address, "upokt");
        return result.amount;
    }

    /**
     * Obtiene las transacciones de una wallet
     * @param address - La dirección de la wallet
     * @returns {Promise<Transaction[]>} Lista de transacciones
     */
    async getTransactions(address: string): Promise<Transaction[]> {
        if (!this.client) throw new Error('Cliente no inicializado');

        const sendTx = await this.client.searchTx(`message.sender='${address}'`);
        const sendTransactions: Transaction[] = this.decodeTransactions(sendTx).map((message) => ({
            ...message,
            type: "send",
        }));

        const recvTx = await this.client.searchTx(`transfer.recipient='${address}'`);
        const recvTransactions: Transaction[] = this.decodeTransactions(recvTx).map((message) => ({
            ...message,
            type: "recv",
        }));

        const transactions = [...sendTransactions, ...recvTransactions];
        return transactions.sort((a, b) => b.height - a.height);
    }

    private decodeTransactions(txs: IndexedTx[]): Transaction[] {
        const messages: Transaction[] = [];

        for (const tx of txs) {
            const decodedTx = Tx.decode(tx.tx);

            if (!decodedTx.body) {
                continue;
            }

            for (const message of decodedTx.body.messages) {
                const decodedMessage = MsgSend.decode(message.value);

                let amount;

                for (const coin of decodedMessage.amount) {
                    if (coin.denom === "upokt") {
                        amount = coin.amount;
                        break;
                    }
                }

                if (!amount) {
                    continue;
                }

                messages.push({
                    hash: tx.hash,
                    from: decodedMessage.fromAddress,
                    to: decodedMessage.toAddress,
                    value: amount,
                    timestamp: tx.height,
                    status: 'confirmed',
                    type: 'send',
                    height: tx.height
                });
            }
        }

        return messages;
    }

    /**
     * Envía una transacción
     * @param to - Dirección destino
     * @param amount - Cantidad a enviar en upokt
     * @returns {Promise<string>} Hash de la transacción
     */
    async sendTransaction(to: string, amount: string): Promise<string> {
        if (!this.wallet || !this.client) {
            throw new Error('Wallet o cliente no inicializado');
        }

        const [firstAccount] = await this.wallet.getAccounts();
        const currentNetwork = this.getCurrentNetwork();

        this.signingClient = await SigningStargateClient.connectWithSigner(
            currentNetwork.rpcUrl,
            this.wallet
        );

        const result = await this.signingClient.sendTokens(
            firstAccount.address,
            to,
            [{ denom: 'upokt', amount }],
            {
                amount: [{ denom: 'upokt', amount: '5000' }],
                gas: '200000',
            }
        );

        return result.transactionHash;
    }
} 