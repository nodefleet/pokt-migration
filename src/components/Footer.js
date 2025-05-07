const Footer = () => {
    return `
        <footer class="flex flex-col sm:flex-row sm:justify-between sm:items-center p-2 sm:p-4 border-t border-gray-700 text-white space-y-4 sm:space-y-0">
            <div class="flex items-center space-x-2 sm:space-x-4">
                <a href="https://x.com" target="_blank" rel="noopener">
                    <img src="assets/images/x.svg" alt="X (Twitter)" class="h-5 w-5 sm:h-6 sm:w-6" />
                </a>
                <a href="https://github.com" target="_blank" rel="noopener">
                    <img src="assets/images/github.svg" alt="GitHub" class="h-5 w-5 sm:h-6 sm:w-6" />
                </a>
                <a href="https://discord.com" target="_blank" rel="noopener">
                    <img src="assets/images/discord.svg" alt="Discord" class="h-5 w-5 sm:h-6 sm:w-6" />
                </a>
            </div>
            <div class="flex items-center space-x-2">
                <span class="text-xs sm:text-sm">2025 Powered by</span>
                <img src="assets/images/nodefleet.png" alt="nodefleet logo" class="h-5 sm:h-6" style="margin-bottom: -2px;" />
            </div>
        </footer>
    `;
};

export default Footer;