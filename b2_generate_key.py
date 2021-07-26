#  B2_MASTER_CREDENTIALS='master-key-id:master-key' BUCKET_ID='...' python3 b2_generate_key.py
import os, requests

master_credentials = tuple(os.getenv('B2_MASTER_CREDENTIALS').split(':'))
authorization = requests.get('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', auth=master_credentials).json()
print(authorization)

response = requests.post(authorization['apiUrl'] + '/b2api/v2/b2_create_key', headers={'Authorization': authorization['authorizationToken']}, json={
	'accountId': authorization['accountId'],
	'capabilities': ['listFiles', 'readFiles', 'shareFiles', 'writeFiles', 'deleteFiles'],
	'keyName': 'unfurlify',
	'bucketId': os.getenv('BUCKET_ID')
}).text
print(response)
