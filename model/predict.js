let csv = require("fast-csv");
let gaussian = require("gaussian");

const one_day = 1000 * 60 * 60 * 24;
const untilElection = (new Date(2016, 11, 08) - Date.now()) / one_day;
const historical_weight = untilElection / 365;
const shift = +0.04;

let data2012 = [];

function loadData() { 
    return new Promise((resolve, reject) => {
        // load 2012 data
        csv.fromPath("data/2012.csv", {headers: true})
            .on("data", d => data2012.push(d))
            .on("end", () => {
                sortByKey(data2012, "name");
                processElection(data2012);
                resolve();
            })
            .on("error", e => reject(e));
    });
}

function processElection(data) {
    const variance = Math.pow(0.10, 2) * historical_weight;

    for (let state of data) {
        state.gap = (state.democratic - state.republican) / state.totalVoters;
        state.variance = variance + Math.abs(state.gap) / 4;
    }
}

function modelState(index, nationalShift) {
    let state = data2012[index]; 

    let mean = state.gap + nationalShift + shift;
    let gap = gaussian(mean, state.variance).ppf(Math.random());

    let dem = 0.5 + gap / 2;
    let gop = 0.5 - gap / 2;
    
    return {
        dem,
        gop,
    };
}


module.exports = function(self) {
    self.loadData = loadData;
    self.modelState = modelState;
};

function sortByKey(arr, key) {
    return arr.sort((a, b) => {
        let x = a[key];
        let y = b[key];

        return (x < y) ? -1 : (x > y) ? 1 : 0;
    });
}
