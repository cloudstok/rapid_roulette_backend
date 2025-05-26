import { generateUUIDv7, updateBalanceFromAccount } from '../../utilities/common-function';
import { appConfig } from '../../utilities/app-config';
import { setCache, getCache } from '../../utilities/redis-connection';
import { getBetResult, getUserIP, logEventAndEmitResponse } from '../../utilities/helper-function';
import { createLogger } from '../../utilities/logger';
import { Server, Socket } from 'socket.io';
import { ReqData } from '../../interfaces';
const logger = createLogger('Bets', 'jsonl');

export const placeBet = async (socket: Socket, betData: ReqData[]) => {
    try {
        const playerDetails = await getCache(`PL:${socket.id}`);
        if (!playerDetails) return socket.emit('betError', 'Invalid Player Details');
        const parsedPlayerDetails = JSON.parse(playerDetails);
        const { userId, operatorId, token, game_id, balance } = parsedPlayerDetails;
        const totalBetAmount = betData.reduce((total, bet) => total + bet.btAmt, 0);
        if (totalBetAmount > balance) return socket.emit('betError', 'Insufficient Balance');
        if (totalBetAmount > appConfig.maxBetAmount || totalBetAmount < appConfig.minBetAmount) {
            return socket.emit('betError', 'Invalid Bet Amount');
        };
        const matchId: string = generateUUIDv7();
        const userIP = getUserIP(socket);
        const webhookData = await updateBalanceFromAccount({
            id: matchId,
            bet_amount: totalBetAmount,
            game_id,
            ip: userIP,
            user_id: userId
        }, "DEBIT", { game_id, operatorId, token });

        if (!webhookData.status) return socket.emit("betError", "Bet Cancelled By Upstream Server");
        parsedPlayerDetails.balance = parsedPlayerDetails.balance - totalBetAmount;
        await setCache(`PL:${socket.id}`, JSON.stringify(parsedPlayerDetails));

        socket.emit("info", {
            user_id: userId,
            operator_id: operatorId,
            balance: parsedPlayerDetails.balance
        });


        
    } catch (err) {

    }

};