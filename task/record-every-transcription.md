## Add a record in DB for every transcription
When user completes a recording and transcription, insert one record into DB for the transaction.
these records can be used later for data analytics.

## Context
the Mac electron app will make call to this server and initiate requests like user authentication and Aliyun speech-to-text API

## proposed schema
- transaction Id
- which user 
- duration of recording
- Count of transcribed words (one Chinese character as one word, one English word as one word)
- timestamp of transaction
- status of transaction (success, failed)

## insertion logic
insert the record when the transaction is completed (when transcribed result returned from Aliyun)
either recording or transcription failed, mark the transaction status as failed