const baseUrl = process.env.UNIQUE_ONE_BASE_URL || 'https://unique-one-162s.onrender.com';
const token = process.env.PAY_SMALL_SMALL_CRON_TOKEN || '';
if (!token) throw new Error('PAY_SMALL_SMALL_CRON_TOKEN is required');
const response = await fetch(baseUrl + '/api/pay-small-small/system/sync', {
  method: 'POST',
  headers: { 'x-pay-small-small-cron-token': token, 'content-type': 'application/json' },
});
const body = await response.text();
if (!response.ok) throw new Error('Pay Small Small sync failed (' + response.status + '): ' + body);
console.log(body);
