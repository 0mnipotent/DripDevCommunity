const Web3 = require('web3');
const web3 = new Web3.default('https://bsc-dataseed.binance.org/');
const mysql = require('mysql');

const contractAddress = '0xffe811714ab35360b67ee195ace7c10d93f89d8c'; // faucet contract address
const abi = [
  {
    constant: true,
    inputs: [{ name: '_addr', type: 'address' }],
    name: 'userInfo',
    outputs: [
      { name: 'upline', type: 'address' },
      { name: 'deposit_time', type: 'uint256' },
      { name: 'deposits', type: 'uint256' },
      { name: 'payouts', type: 'uint256' },
      { name: 'direct_bonus', type: 'uint256' },
      { name: 'match_bonus', type: 'uint256' },
      { name: 'last_airdrop', type: 'uint256' }
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

async function updatePlayerFaucetData(address) {
  try {
    const userInfo = await contract.methods.userInfo(address).call();
    const deposits = web3.utils.fromWei(userInfo.deposits.toString(), 'ether');
    const payouts = web3.utils.fromWei(userInfo.payouts.toString(), 'ether');

    const updateSql = `UPDATE winning_players SET faucet_deposit = ${deposits}, faucet_claimed = ${payouts} WHERE player_address = "${address}"`;

    return new Promise((resolve, reject) => {
      connection.query(updateSql, (error, results) => {
        if (error) reject(error);
        resolve(results);
      });
    });
  } catch (e) {
    console.error(`Failed to update data for address: ${address}. Error: ${e.message}`);
  }
}

async function getWinningPlayerAddresses() {
  return new Promise((resolve, reject) => {
    connection.query('SELECT player_address FROM winning_players', (error, results) => {
      if (error) reject(error);
      resolve(results.map(result => result.player_address));
    });
  });
}

async function updateAllPlayersFaucetData() {
  const playerAddresses = await getWinningPlayerAddresses();
  for (let address of playerAddresses) {
    await updatePlayerFaucetData(address);
  }
  connection.end();
}

updateAllPlayersFaucetData();
