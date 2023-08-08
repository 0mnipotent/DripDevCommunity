const Web3 = require('web3');
const web3 = new Web3.default('https://bsc-dataseed.binance.org/');
const mysql = require('mysql');


const contractAddress = '0xDdB33A6613FBd73A3b9c39a04Cc15738E38da370';
const abi = [
  {
    constant: true,
    inputs: [],
    name: 'currentRound',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function'
  },
  {
    constant: true,
    inputs: [{ name: '', type: 'uint256' }],
    name: 'getRoundWinners',
    outputs: [
      { name: 'firstPrizeWinner', type: 'address' },
      { name: 'runnerUpWinners', type: 'address[4]' },
      { name: 'biggestDepositorWithSacrificeWinner', type: 'address' },
      { name: 'biggestDepositorWithoutSacrificeWinner', type: 'address' }
    ],
    type: 'function'
  }
];



const contract = new web3.eth.Contract(abi, contractAddress);

// MySQL Connection
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'dripdropdrawdata',
  password: 'dripdropdrawdata',
  database: 'dripdropdrawdata'
});

connection.connect();

async function isLoggedRound(roundId) {
  return new Promise((resolve, reject) => {
    connection.query(`SELECT round_id FROM round_results WHERE round_id = ${roundId}`, (error, results) => {
      if (error) reject(error);
      resolve(results.length > 0);
    });
  });
}

async function logRound(roundId, winners) {
  let sql = `INSERT INTO round_results (
      round_id,
      first_prize_winner,
      runner_up_winner_1,
      runner_up_winner_2,
      runner_up_winner_3,
      runner_up_winner_4,
      sacrifice_winner,
      deposit_winner
    ) VALUES (
      ${roundId},
      "${winners.firstPrizeWinner}",
      "${winners.runnerUpWinners[0]}",
      "${winners.runnerUpWinners[1]}",
      "${winners.runnerUpWinners[2]}",
      "${winners.runnerUpWinners[3]}",
      "${winners.biggestDepositorWithSacrificeWinner}",
      "${winners.biggestDepositorWithoutSacrificeWinner}"
    )`;

  return new Promise((resolve, reject) => {
    connection.query(sql, (error, results) => {
      if (error) reject(error);
      resolve(results);
    });
  });
}

async function isLoggedPlayer(address) {
  return new Promise((resolve, reject) => {
    connection.query(`SELECT player_address FROM winning_players WHERE player_address = "${address}"`, (error, results) => {
      if (error) reject(error);
      resolve(results.length > 0);
    });
  });
}

async function logPlayerWinning(category, address) {
  let column;
  if (category == 'First Prize Winner') column = 'first_places';
  else if (category == 'Runner Up Winner') column = 'runner_up_places';
  else if (category == 'Sacrifice Winner') column = 'sacrifice_places';
  else if (category == 'Deposit Winner') column = 'deposit_places';

  let sql;
  // if player logged, increment by one, otherwise insert new with one
  if (await isLoggedPlayer(address)) {
    sql = `UPDATE winning_players SET ${column} = ${column} + 1 WHERE player_address = "${address}"`;
  } else {
    sql = `INSERT INTO winning_players (player_address, ${column}) VALUES ("${address}", 1)`;
  }

  return new Promise((resolve, reject) => {
    connection.query(sql, (error, results) => {
      if (error) reject(error);
      resolve(results);
    });
  });
}

async function getRoundData() {
  const maxRound = await contract.methods.currentRound().call();

  for (let round = 1; round <= maxRound; round++) {
    // if the round has been logged, skip to the next
    if (await isLoggedRound(round)) {
      continue;
    }

    try {
      const winners = await contract.methods.getRoundWinners(round).call();

      // log the round
      await logRound(round, winners);

      // log/update the winners
      await logPlayerWinning("First Prize Winner", winners.firstPrizeWinner);
      for (let i = 0; i < 4; i++) {
        await logPlayerWinning("Runner Up Winner", winners.runnerUpWinners[i]);
      }
      await logPlayerWinning("Sacrifice Winner", winners.biggestDepositorWithSacrificeWinner);
      await logPlayerWinning("Deposit Winner", winners.biggestDepositorWithoutSacrificeWinner);

    } catch(e) {
      console.log(`Round: ${round} has not ended yet`);
    }
  }

  connection.end();
}

getRoundData();
