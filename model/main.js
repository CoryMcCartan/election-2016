let fetch = require("node-fetch");

fetch("http://elections.huffingtonpost.com/pollster/api/polls.json?topic=2016-president")
    .then(e => e.json())
    .then(e => console.log(e));

console.log("Done.");
