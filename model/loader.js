let fetch = require("node-fetch");
let csv = require("fast-csv");
let util = require("./util.js");


function get2012Election() {
    let data2012 = [];
    
    return new Promise((resolve, reject) => {
        csv.fromPath("data/2012.csv", {headers: true})
        .on("data", d => data2012.push(d))
        .on("end", () => {
            util.sortByKey(data2012, "name");
            resolve(data2012);
        })
        .on("error", reject);
    });
}

function getPollsterRatings() {
    let pollsters = [];

    return new Promise((resolve, reject) => {
        // load pollster ratings
        csv.fromPath("data/pollster-ratings.tsv", {
            headers: true,
            delimiter: "\t",
        })
        .on("data", d => pollsters.push(d))
        .on("end", () => {
            resolve(pollsters);
        })
        .on("error", reject);
    });
}

function getPolls(topicName) {
    let makeURL = n => `http://elections.huffingtonpost.com/pollster/api/` + 
        `polls.json?page=${n}&topic=${topicName}`;

    let promises = [];
    //          get     n    pages worth of polls
    for (let i = 0; i < 5; i++) {
        promises[i] = fetch(makeURL(i)).then(t => t.json());
    }

    // wait until all data is fetched
    return new Promise((resolve, reject) => {
        Promise.all(promises).then((values) => {
            // flatten
            let polls = values.reduce((p, c) => p.concat(c));
            resolve(polls);
        });
    });
}

module.exports = {
    get2012Election,
    getPollsterRatings,
    getPolls,
};
