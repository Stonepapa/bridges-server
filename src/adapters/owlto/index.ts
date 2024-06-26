import { BridgeAdapter, PartialContractEventParams } from "../../helpers/bridgeAdapter.type";
import { getTxDataFromEVMEventLogs } from "../../helpers/processTransactions";
import { constructTransferParams } from "../../helpers/eventParams";
import { Chain } from "@defillama/sdk/build/general";
import { EventData } from "../../utils/types";
import { getTxsBlockRangeEtherscan, wait } from "../../helpers/etherscan";

const retry = require("async-retry");

export const bridgesAddress = {
    arbitrum: ["0x5e809A85Aa182A9921EDD10a4163745bb3e36284"],
    arbitrum_nova: ["0x5e809A85Aa182A9921EDD10a4163745bb3e36284"],
    ethereum: ["0x5e809A85Aa182A9921EDD10a4163745bb3e36284"],
    bsc: ["0x5e809A85Aa182A9921EDD10a4163745bb3e36284"],
    polygon: ["0x5e809A85Aa182A9921EDD10a4163745bb3e36284"],
    optimism: ["0x5e809A85Aa182A9921EDD10a4163745bb3e36284"],
    era: ["0x5e809A85Aa182A9921EDD10a4163745bb3e36284"],
    polygon_zkevm: ["0x5e809A85Aa182A9921EDD10a4163745bb3e36284"],

    base: ["0x5e809A85Aa182A9921EDD10a4163745bb3e36284"],
    linea: ["0x5e809A85Aa182A9921EDD10a4163745bb3e36284"],
    manta: ["0x5e809A85Aa182A9921EDD10a4163745bb3e36284"],
    scroll: ["0x5e809A85Aa182A9921EDD10a4163745bb3e36284"],
    mantle: ["0x5e809A85Aa182A9921EDD10a4163745bb3e36284"],

    metis: ["0x5e809A85Aa182A9921EDD10a4163745bb3e36284"],
    mode: ["0x5e809A85Aa182A9921EDD10a4163745bb3e36284"],
    blast: ["0x5e809A85Aa182A9921EDD10a4163745bb3e36284"],

} as const;

export const contractsAddress = {
    arbitrum: ["0x0e83DEd9f80e1C92549615D96842F5cB64A08762"],
    arbitrum_nova: ["0x0e83DEd9f80e1C92549615D96842F5cB64A08762"],
    ethereum: ["0x0e83DEd9f80e1C92549615D96842F5cB64A08762"],
    bsc: ["0xC626845BF4E6a5802Ef774dA0B3DfC6707F015F7"],
    polygon: ["0xC626845BF4E6a5802Ef774dA0B3DfC6707F015F7"],
    optimism: ["0x0e83DEd9f80e1C92549615D96842F5cB64A08762"],
    era: ["0x95cDd9632C924d2cb5586168Cf0Ba7640dF30598"],
    polygon_zkevm: ["0xC626845BF4E6a5802Ef774dA0B3DfC6707F015F7"],

    base: ["0xC626845BF4E6a5802Ef774dA0B3DfC6707F015F7"],
    linea: ["0xC626845BF4E6a5802Ef774dA0B3DfC6707F015F7"],
    manta: ["0xC626845BF4E6a5802Ef774dA0B3DfC6707F015F7"],
    scroll: ["0xC626845BF4E6a5802Ef774dA0B3DfC6707F015F7"],
    mantle: ["0xC626845BF4E6a5802Ef774dA0B3DfC6707F015F7"],

    metis: ["0xC626845BF4E6a5802Ef774dA0B3DfC6707F015F7"],
    mode: ["0xC626845BF4E6a5802Ef774dA0B3DfC6707F015F7"],
    blast: ["0xC626845BF4E6a5802Ef774dA0B3DfC6707F015F7"],

} as const;

const nativeTokens: Record<string, string> = {
    ethereum: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    arbitrum: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    optimism: "0x4200000000000000000000000000000000000006",
    base: "0x4200000000000000000000000000000000000006",
    linea: "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f",
    blast: "0x4300000000000000000000000000000000000004",
    scroll: "0x5300000000000000000000000000000000000004",
    mode: "0x4200000000000000000000000000000000000006",
    polygon: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    manta: "0x0Dc808adcE2099A9F62AA87D9670745AbA741746",
    polygon_zkevm: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    era: "0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91",
    arbitrum_nova: "0x722E8BdD2ce80A4422E880164f2079488e115365",
};

type SupportedChains = keyof typeof bridgesAddress;

const constructParams = (chain: SupportedChains) => {
    const bridgeAddress = bridgesAddress[chain];
    const contractAddress = contractsAddress[chain];

    let eventParams = [] as any;
    bridgeAddress.map((address: string) => {
        const transferWithdrawalParams: PartialContractEventParams = constructTransferParams(address, false);
        const transferDepositParams: PartialContractEventParams = constructTransferParams(address, true);
        eventParams.push(transferWithdrawalParams, transferDepositParams);
    });

    return async (fromBlock: number, toBlock: number) => {
        const eventLogData = await getTxDataFromEVMEventLogs("owlto", chain as Chain, fromBlock, toBlock, eventParams);

        const nativeEvents = await Promise.all([
            ...bridgeAddress.map(async (address: string, i: number) => {
                await wait(300 * i); // for etherscan
                const txs = await getTxsBlockRangeEtherscan(chain, address, fromBlock, toBlock, {
                    includeSignatures: ["0x"],
                });
                const eventsRes: EventData[] = txs.map((tx: any) => {
                    const event: EventData = {
                        txHash: tx.hash,
                        blockNumber: +tx.blockNumber,
                        from: tx.from,
                        to: tx.to,
                        token: nativeTokens[chain],
                        amount: tx.value,
                        isDeposit: address === tx.to,
                    };
                    return event;
                });

                return eventsRes;
            }),
            ...contractAddress.map(async (address: string, i: number) => {
                await wait(300 * i); // for etherscan
                const txs = await getTxsBlockRangeEtherscan(chain, address, fromBlock, toBlock, {
                    includeSignatures: ["0xfc180638"],
                });
                const eventsRes: EventData[] = txs.filter((tx: any) => String(tx.value) != "0").map((tx: any) => {
                    const event: EventData = {
                        txHash: tx.hash,
                        blockNumber: +tx.blockNumber,
                        from: tx.from,
                        to: tx.to,
                        token: nativeTokens[chain],
                        amount: tx.value,
                        isDeposit: address === tx.to,
                    };
                    return event;
                });

                return eventsRes;
            })
        ]
        );
        const allEvents = [...eventLogData, ...nativeEvents.flat()];
        return allEvents;
    };
}


const adapter: BridgeAdapter = {
    ethereum: constructParams("ethereum"),
    arbitrum: constructParams("arbitrum"),
    optimism: constructParams("optimism"),
    base: constructParams("base"),
    linea: constructParams("linea"),
    blast: constructParams("blast"),
    polygon: constructParams("polygon"),
    scroll: constructParams("scroll"),
    // mode: constructParams("mode"), no etherscan
    // manta: constructParams("manta"),
    "arbitrum nova": constructParams("arbitrum_nova"),
    "polygon zkevm": constructParams("polygon_zkevm"),
    "zksync era": constructParams("era"),
};

export default adapter;
