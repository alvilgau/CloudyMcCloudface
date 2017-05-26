
const serviceToLog = process.argv[2];
if (!serviceToLog) {
  console.error(`usage: node someService.js | node log_service.js serviceNameToLog`);
  process.exit(1);
}
process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', function(chunk) {
  const lines = chunk.split('\n');
  lines.filter(line => line.length !== 0)
       .forEach(line => console.log(`[${serviceToLog}] ${line}`));                  
});
