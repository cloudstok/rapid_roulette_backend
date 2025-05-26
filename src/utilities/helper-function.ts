import { BetResult, ReqData, SingleBetData } from '../interfaces';
import { appConfig } from './app-config';
import { createLogger } from './logger';
import { Socket } from 'socket.io';

const failedBetLogger = createLogger('failedBets', 'jsonl');

export const logEventAndEmitResponse = (
    socket: Socket,
    req: any,
    res: string,
    event: string
): void => {
    const logData = JSON.stringify({ req, res });
    if (event === 'bet') {
        failedBetLogger.error(logData);
    }
    socket.emit('betError', { message: res, status: false });
};


export const getUserIP = (socket: any): string => {
    const forwardedFor = socket.handshake.headers?.['x-forwarded-for'];
    if (forwardedFor) {
        const ip = forwardedFor.split(',')[0].trim();
        if (ip) return ip;
    }
    return socket.handshake.address || '';
};

function getRandomNumber() {
    return Math.floor(Math.random() * 13);
}

const rangeChips: Record<number, string> = {
    13: '1-2-3-4-5-6',
    14: '4-5-6-7-8-9',
    15: '7-8-9-10-11-12'
}

export const colorMathChips: Record<number, string> = {
    16: 'even',
    17: 'black',
    18: 'red',
    19: 'odd',
}

const chipMaps: Record<number, string> = {
    20: '3-6-9-12',
    21: '2-5-8-11',
    22: '1-4-7-10'
}


export function calculateWinnings(betStructure: ReqData[]) {
    const winningNumber = getRandomNumber(); // For example, a random number from 1 to 12
    let totalWinAmount = 0;
    const resultBets: BetResult[] = [];

    for (const bet of betStructure) {
        const chip = bet.chip.split("-").map(Number);
        const finalObj = {
            btAmt: bet.btAmt,
            chip,
            winAmt: 0,
            mult: 0,
            status: 'loss'
        }
        if (chip.length == 1) {
            const singleChip: number = chip[0];
            if (singleChip == winningNumber) {
                finalObj['mult'] = 11;
                finalObj['status'] = 'win';
                finalObj['winAmt'] = finalObj['mult'] * finalObj['btAmt'];
            }
            if (rangeChips[singleChip]) {
                const rangeValue: string = rangeChips[singleChip];
                const chipNumbers = rangeValue.split('-').map(Number);
                if (chipNumbers.includes(winningNumber)) {
                    finalObj['mult'] = 11;
                    finalObj['status'] = 'win';
                    finalObj['winAmt'] = finalObj['mult'] * finalObj['btAmt'];
                }
            };
            if (colorMathChips[singleChip]) {
                const isEven = winningNumber % 2;
                if ((singleChip == 16 && isEven) || (singleChip == 19 && !isEven)) {
                    finalObj['mult'] = 11;
                    finalObj['status'] = 'win';
                    finalObj['winAmt'] = finalObj['mult'] * finalObj['btAmt'];
                }
                const blackNums = [2, 4, 6, 8, 10, 12];
                const redNums = [1, 3, 5, 7, 9, 11];
                if ((singleChip == 17 && blackNums.includes(winningNumber)) || singleChip == 18 && redNums.includes(winningNumber)) {
                    finalObj['mult'] = 11;
                    finalObj['status'] = 'win';
                    finalObj['winAmt'] = finalObj['mult'] * finalObj['btAmt'];
                }
            }
            if (chipMaps[singleChip]) {
                const rangeChipsValue: string = chipMaps[singleChip];
                const numRange = rangeChipsValue.split('-').map(Number);
                if (numRange.includes(winningNumber)) {
                    finalObj['mult'] = 11;
                    finalObj['status'] = 'win';
                    finalObj['winAmt'] = finalObj['mult'] * finalObj['btAmt'];
                }
            }
        };
        if (chip.length > 1) {
            if (chip.includes(winningNumber)) {
                finalObj['mult'] = 11;
                finalObj['status'] = 'win';
                finalObj['winAmt'] = finalObj['mult'] * finalObj['btAmt'];
            }
        };
        if(finalObj['status'] == 'win') totalWinAmount += finalObj['winAmt'];
        
        resultBets.push(finalObj);
    }

    return {
        winningNumber,
        totalWinAmount,
        betResults: resultBets
    };
}