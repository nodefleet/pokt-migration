import { fetchData } from "./db";
import { chains } from "./relay";
import {
  getCurrentWeekDates,
  updateLast24HoursRange,
  updateLastMonthDates,
} from "./governance";
import { PointWithTransactionsTotal } from "./interface";

export const getTransactionsByAddress = async (
  address: string,
  limit: number
) => {
  const { ListPoktTransactionForSelection: transactions } = await fetchData(`
  query {
    ListPoktTransactionForSelection(input: {
      node_selection: {
        addresses:"${address}"
      },
      pagination: {
        limit: ${limit},
        sort: [
          {
           property:"block_time",
            direction: -1
          }
        ],
        filter: {
         operator:AND,
         properties: [],
         filters: []
        }
      },
     only_staked: false
    }) {
      pageInfo {
        has_next
        has_previous
        next
        previous
        totalCount
        __typename
      }
      items {
        _id
        hash
        height
        amount
        block_time
        from_address
        index
        memo
        parse_time
        result_code
        to_address
        total_fee
        total_proof
        total_pokt
        type
        chain
        app_public_key
        claim_tx_hash
        expiration_height
        session_height
        pending
        __typename
      }
      __typename
    }
  } `);

  return { transactions: transactions.items };
};

export const getTransactionStats = async () => {
  const [{ endDate24H, startDate24H }, { endDate, startDate }] =
    await Promise.all([updateLast24HoursRange(), updateLastMonthDates()]);
  const GetChainsRewardsBetweenDates = fetchData(`query {
    last24h: GetChainsRewardsBetweenDates(input: {
    start_date: "${startDate24H}",
    end_date: "${endDate24H}"
  }) {
      chain
      total_relays
      staked_nodes_avg
      pokt_avg
      __typename
    }
  }`);
  const ListSummaryBetweenDates = fetchData(`query {
      ListSummaryBetweenDates(input: {
        unit_time: day,
        interval: 1,
        start_date: "${startDate}",
        end_date: "${endDate}",
        date_format: "YYYY-MM-DD"
    }) {
        point_format
        points {
          point
          start_date
          end_date
          first_height
          last_height
          total_relays
          total_minted
          total_computed_cost
          __typename
        }
        __typename
      }
    }`);
  const [{ last24h: last24h }, { ListSummaryBetweenDates: dataRelay }] =
    await Promise.all([GetChainsRewardsBetweenDates, ListSummaryBetweenDates]);
  const dataRelays = dataRelay.points.map((x: any) => ({
    date: x.point,
    count: x.total_relays,
  }));
  const dataDought = last24h.map((x: any) => ({
    date: chains.find((j) => j.id === x.chain)?.full_name,
    count: x.total_relays,
  }));
  dataDought.sort(
    (a: { count: number }, b: { count: number }) => b.count - a.count
  );
  if (dataDought.length > 5) {
    const otherCount = dataDought
      .slice(5)
      .reduce((acc: any, curr: { count: any }) => acc + curr.count, 0);
    const otherItem = { date: "Other", count: otherCount };
    dataDought.splice(5);
    dataDought.push(otherItem);
  }
  return {
    dataChartVetical: dataRelays,
    resultDought: dataDought,
  };
};

export const getLatestTransactions = async () => {
  const { ListPoktTransactionForSelection: transactions } = await fetchData(`
    query {
      ListPoktTransactionForSelection(input: {
        node_selection: {},
        pagination: {
          limit: 10,
          sort: [
            {
             property:"block_time",
              direction: -1
            }
          ],
          filter: {
           operator:AND,
           properties: [],
           filters: []
          }
        },
       only_staked: false
      }) {
        items {
          _id
          hash
          height
          amount
          block_time
          from_address
          index
          memo
          parse_time
          result_code
          to_address
          total_fee
          total_proof
          total_pokt
          type
          chain
          app_public_key
          claim_tx_hash
          expiration_height
          session_height
          pending
          __typename
        }
        __typename
      }
    }
  `);

  return { transactions: transactions.items };
};

export const getDataChart = async (): Promise<PointWithTransactionsTotal[]> => {
  const { start_date, end_date } = await getCurrentWeekDates();
  const { ListTotalOfTransactionBetweenDates } = await fetchData(`query {
    ListTotalOfTransactionBetweenDates(
    input: {
      unit_time: day,
      interval: 1,
      types: [],
      start_date: "${start_date}",
      end_date: "${end_date}",
      date_format: "YYYY-MM-DDTHH:mm:ss.SSSZ"
    }
  ) {
      points {
        end_date
        start_date
        total_good_txs
        total_bad_txs
        total_txs
        point
      }
    }
  }`);
  return ListTotalOfTransactionBetweenDates.points as PointWithTransactionsTotal[];
};

/*  SELECT b.*, t.* FROM (SELECT * FROM blocks WHERE time >= NOW() - INTERVAL '30 days') AS b LEFT JOIN transactions t ON t.height = b.height; select transation */

/* SELECT date_trunc('day', b.time) AS date, COUNT(t.height) AS count FROM blocks AS b LEFT JOIN transactions t ON t.height = b.height WHERE b.time >= NOW() - INTERVAL '30 days' OR b.time IS NULL GROUP BY date  asadsdadsasasasd */
