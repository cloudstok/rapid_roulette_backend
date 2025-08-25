import { generateUUIDv7, updateBalanceFromAccount } from '../../utilities/common-function';
import { appConfig } from '../../utilities/app-config';
import { setCache, getCache } from '../../utilities/redis-connection';
import { calculateWinnings, getUserIP, logEventAndEmitResponse } from '../../utilities/helper-function';
import { createLogger } from '../../utilities/logger';
import { Socket } from 'socket.io';
import { AccountsResult, FinalUserData, ReqData } from '../../interfaces';
import { insertBets } from './bets-db';
const logger = createLogger('Bets', 'jsonl');
const numberChips = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 21, 22];
const oddEvenChips = [16, 17, 18, 19];

export const placeBet = async (socket: Socket, betData: ReqData[]) => {
    try {

        const playerDetailsRaw = await getCache(`PL:${socket.id}`);
        if (!playerDetailsRaw) {
            socket.emit('betError', 'Invalid Player Details');
            return;
        };

        let parsedPlayerDetails: FinalUserData;

        try {
            parsedPlayerDetails = JSON.parse(playerDetailsRaw);
        } catch (err) {
            socket.emit('betError', 'Failed to parse player details');
            return;
        };

        const { userId, operatorId, token, game_id, balance } = parsedPlayerDetails;
        const totalBetAmount = betData.reduce((total, bet) => total + bet.btAmt, 0);

        if (totalBetAmount > balance) {
            socket.emit('betError', 'Insufficient Balance');
            return;
        };

        let isBetInvalid: Boolean = false;

        if (betData.length > 10) {
            return logEventAndEmitResponse(socket, 'betError', 'Bet limit exceeded', "bet");
        }

        for (const bet of betData) {
            const { chip, btAmt } = bet;
            const chips = chip.split('-').map(Number);

            if (chips.length === 1) {
                const singleChip = chips[0];
                if (
                    (numberChips.includes(singleChip) &&
                        (btAmt < appConfig.minBetAmount || btAmt > appConfig.maxBetAmount)) ||
                    (oddEvenChips.includes(singleChip) &&
                        (btAmt < appConfig.minBetAmount || btAmt > appConfig.maxBetAmountOE))
                ) {
                    isBetInvalid = true;
                    break;
                }
            }

            if (chips.length > 1) {
                if (btAmt < appConfig.minBetAmount || btAmt > appConfig.maxBetAmount) {
                    isBetInvalid = true;
                    break;
                }
            }
        };

        if (isBetInvalid) {
            socket.emit("betError", "Invalid Bet");
            return;
        };

        const matchId: string = generateUUIDv7();
        const userIP = getUserIP(socket);

        const webhookData: AccountsResult = await updateBalanceFromAccount({
            id: matchId,
            bet_amount: totalBetAmount,
            game_id,
            ip: userIP,
            user_id: userId
        }, "DEBIT", { game_id, operatorId, token });

        if (!webhookData.status) {
            socket.emit("betError", "Bet Cancelled By Upstream Server");
            return;
        };

        socket.emit('bet_placed', { message: 'Init bet successfully' });
        parsedPlayerDetails.balance -= totalBetAmount;
        await setCache(`PL:${socket.id}`, JSON.stringify(parsedPlayerDetails));

        socket.emit("info", {
            user_id: userId,
            operator_id: operatorId,
            balance: parsedPlayerDetails.balance
        });

        const { winningNumber, totalWinAmount, betResults } = calculateWinnings(betData);

        logger.info(JSON.stringify({ player: parsedPlayerDetails, totalBetAmount, totalWinAmount, betResults }));

        if (totalWinAmount > 0) {
            setTimeout(async () => {
                const creditData = {
                    id: matchId,
                    bet_amount: totalBetAmount,
                    winning_amount: totalWinAmount,
                    game_id: game_id,
                    user_id: userId,
                    txn_id: webhookData?.txn_id,
                    ip: userIP
                };
                await updateBalanceFromAccount(creditData, "CREDIT", parsedPlayerDetails)
                parsedPlayerDetails.balance += totalWinAmount;
                await setCache(`PL:${parsedPlayerDetails.socketId}`, JSON.stringify(parsedPlayerDetails));

                socket.emit('info', {
                    user_id: userId,
                    operator_id: operatorId,
                    balance: parsedPlayerDetails.balance
                });
            }, 5000);
        };

        const dbObj = {
            match_id: matchId,
            user_id: userId,
            operator_id: operatorId,
            bet_amount: totalBetAmount,
            win_amount: totalWinAmount,
            betResults,
            winningNumber
        };

        await insertBets(dbObj);

        socket.emit('bet_result', {
            winningNumber,
            totalWinAmount,
            status: totalWinAmount > 0
        });

    } catch (err) {
        console.error("Error in placeBet:", err);
        socket.emit('betError', 'Internal Server Error');
    }
};