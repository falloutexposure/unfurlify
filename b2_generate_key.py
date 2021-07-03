#  B2_MASTER_CREDENTIALS='master-key-id:master-key' python3 b2_generate_key.py
import os, requests

master_credentials = tuple(os.getenv('B2_MASTER_CREDENTIALS').split(':'))
authorization = requests.get('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', auth=master_credentials).json()
print(authorization)
# {
#   "absoluteMinimumPartSize": 5000000,
#   "accountId": "[REDACTED]",
#   "allowed": {
#     "bucketId": null,
#     "bucketName": null,
#     "capabilities": [
#       "listKeys",
#       "writeKeys",
#       "deleteKeys",
#       "listAllBucketNames",
#       "listBuckets",
#       "writeBuckets",
#       "deleteBuckets",
#       "readBuckets",
#       "listFiles",
#       "readFiles",
#       "shareFiles",
#       "writeFiles",
#       "deleteFiles",
#       "readBucketEncryption",
#       "writeBucketEncryption",
#       "bypassGovernance",
#       "readBucketRetentions",
#       "writeBucketRetentions",
#       "readFileRetentions",
#       "writeFileRetentions",
#       "readFileLegalHolds",
#       "writeFileLegalHolds"
#     ],
#     "namePrefix": null
#   },
#   "apiUrl": "https://api001.backblazeb2.com",
#   "authorizationToken": "[REDACTED]",
#   "downloadUrl": "https://f001.backblazeb2.com",
#   "recommendedPartSize": 100000000,
#   "s3ApiUrl": "https://s3.us-west-001.backblazeb2.com"
# }


response = requests.post(authorization['apiUrl'] + '/b2api/v2/b2_create_key', headers={'Authorization': authorization['authorizationToken']}, json={
	'accountId': authorization['accountId'],
	'capabilities': ['listFiles', 'readFiles', 'shareFiles', 'writeFiles', 'deleteFiles'],
	'keyName': 'unfurlify',
	'bucketId': 'a692453cb4916c5178ab0011'
}).text
print(response)
# {
#   "accountId": "[REDACTED]",
#   "applicationKey": "[REDACTED]",
#   "applicationKeyId": "001625c41c18b010000000004",
#   "bucketId": "a692453cb4916c5178ab0011",
#   "capabilities": [
#     "listFiles",
#     "readFiles",
#     "shareFiles",
#     "writeFiles",
#     "deleteFiles"
#   ],
#   "expirationTimestamp": null,
#   "keyName": "unfurlify",
#   "namePrefix": null,
#   "options": [
#     "s3"
#   ]
# }
