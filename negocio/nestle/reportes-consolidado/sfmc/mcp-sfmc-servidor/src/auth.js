import axios from 'axios';

let _token = null;
let _expiresAt = 0;

export async function getToken() {
  if (_token && Date.now() < _expiresAt - 30_000) return _token;

  const res = await axios.post(process.env.SFMC_AUTH_URL, {
    grant_type: 'client_credentials',
    client_id: process.env.SFMC_CLIENT_ID,
    client_secret: process.env.SFMC_CLIENT_SECRET,
    account_id: process.env.SFMC_ACCOUNT_ID,
  });

  _token = res.data.access_token;
  _expiresAt = Date.now() + res.data.expires_in * 1000;
  return _token;
}
