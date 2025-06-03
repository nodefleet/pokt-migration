import { fetchData } from "./db";
import { updateLast24HoursRange } from "./governance";

export const getLastBlockHeight = async () => {
  const { ListBlocks } = await fetchData(`query {
    ListBlocks(
      input: {
        pagination: {
          limit: 1,
          sort: [
            {
              property: "height",
              direction: -1
            }
          ],
          filter: {
            operator: AND,
            properties: [],
            filters: []
          }
        }
      }
    ) {
      items {
        height
        __typename
      }
      __typename
    }
  }`);

  const lastBlock = ListBlocks.items[0];
  return { lastBlock };
};

// export const getBlocks = cache(
//   async ({ take, skip }: { take: number; skip: number }) => {
//     const blocks = await prisma.blocks.findMany({
//       take,
//       skip,
//       orderBy: { height: "desc" },
//     });
//     const count = await prisma.blocks.count();
//     return {
//       blocks,
//       count,
//     };
//   }
// );

export const getLatestBlocks = async () => {
  const { ListBlocks } = await fetchData(`query {
    ListBlocks(
      input: {
        pagination: {
          limit: 15,
          sort: [
            {
              property: "parse_time",
              direction: -1
            }
          ],
          filter: {
            operator: AND,
            properties: [],
            filters: []
          }
        }
      }
    ) {
      items {
        _id
        hash
        height
        num_txs
        parse_time
        producer
        time
        total_txs
        __typename
      }
      __typename
    }
  }`);

  return { dataBlock: ListBlocks.items };
};

export const getBlocks = async ({ limit }: { limit: number }) => {
  const { startDate24H, endDate24H } = await updateLast24HoursRange();
  const { ListPoktBlock: dataBlock } = await fetchData(`
  query {
    ListPoktBlock(pagination: {
    sort: [
      {
        property: "_id",
       direction: -1
      }
    ],
   limit: ${limit},
    filter: {
      operator: AND,
      properties: [
        {
          property: "time",
          operator: GTE,
          type: STRING,
          value: "${startDate24H}"
        },
        {
          property: "time",
          operator: LTE,
          type: STRING,
          value: "${endDate24H}"
        }
      ]
    }
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
        height
        took
        time
        producer
        producer_service_url
        total_txs
        total_nodes
        total_relays_completed
        total_size
        nodes_jailed_staked
        nodes_unjailed_staked
        nodes_unjailed_unstaking
        apps_staked
        apps_unstaking
        block_size
        state_size
        __typename
      }
      __typename
    }
  }`);
  return {
    blocks: dataBlock.items,
  };
};
