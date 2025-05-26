import { BetData } from '../../interfaces';
import { write } from '../../utilities/db-connection';

const SQL_INSERT_BETS = 'INSERT INTO settlement (lobby_id, user_id, operator_id, bet_amount, userBets, result, win_amount) VALUES(?,?,?,?,?,?,?)';



export const insertBets = async (data: BetData): Promise<void> => {
  try {
    const { match_id, user_id, operator_id, bet_amount, win_amount, betResults, winningNumber } = data;
    await write(SQL_INSERT_BETS, [
      match_id, decodeURIComponent(user_id), operator_id, Number(bet_amount).toFixed(2), JSON.stringify(betResults), winningNumber, win_amount
    ]);
    console.info(`Bet inserted successfully`, user_id);
  } catch (err) {
    console.error(err);
  }
};