## current
the voice to text API call and other API calls currently use the dev server. I'm not sure, analyze the codebase and confirm

## Expected
the voice to text API call and other API calls needs to use the production server

## context
server.ts in /server is not the real server being used.