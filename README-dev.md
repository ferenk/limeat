# Limeat dev notes
## ONLY FOR DEVELOPERS!

## Run - server side
From the command line: ```npm run start```

## Run - client side
From WebStorm (JetBrains)
    to debug: Configuration: npm Command: run, Scripts: start
    cmdline it uses: /usr/bin/node --import <user_home>/.local/share/JetBrains/Toolbox/apps/webstorm-2/plugins/nodeJS/js/ts-file-loader/node_modules/tsx/dist/loader.cjs <project_root>/server/src/index.ts
    generated files: ...

## Utility commands
1. See logs, continously, updates continously: heroku logs --tail --app limeat
2. See last n lines of logs: heroku logs --app limeat -n 1000

## Tests
1. Run a specific test: ```npm rum test -- -t "EDA test"```

### Curl usage
```curl https://limeat.herokuapp.com/node_api/read_calcdb```
**RESULT:** ```  | ***fruit***  <NL/>  | apple                    |  52 kcal  (granny smith)  <NL/>  | banán                   |  89 kcal  <NL/>...```

```curl https://limeat.herokuapp.com/node_api/read_foodrowdb```

## Update process of the "client version snapshot list" (automatic github action + heroku post build step):

### As a developer you have to do the following actions to have a new "client snapshot"
1. Prepare, test the changes, commit and push to main (for new developers a PR is recommended)
2. Create a new tag in the form vN1.N2[.N3] form (e.g. v0.51) and push it, too.
3. Deploy the new version to heroku. It will automatically use the tar.bz2 created by the github action.

### What the update process does internally   
1. GitHub action which is executed on push: ```github-update-client-version-snapshots```.yml
   Executes *scripts/github-collect-recent-client-versions.sh*
   1. This script collects all recent versions of the client part
   2. It compresses the collection and uploads it github to https://github.com/ferenk/limeat/releases as a tar.bz2
2. Heroku post build step - automatically executed during deploy
   Executes the script *scripts/heroku-fetch-latest-frontend-versions.sh* to get the compressed package to the heroku server 
   1. Downloads the client_versions.tar.bz2 to the github server's internal release folder with *curl*
   2. Uncompresses the tar.bz2 into the client_versions/ folder on the server and then it deletes the archive file

## Sample MD output:
### 06.m
| kCal     | Time                         | Food type  
| -------- |------------------------------| -----------  
|   42.0   | 20:55                        | apple (120g, =70kc)  
|  ***42***| ***(breakfast,before_lunch)*** 120g 
|   ***0***| ***(lunch,before_dinner)*** 0g      
|   ***0***| ***(dinner,snacks)*** 0g     
|  ***42***| 120g                         
