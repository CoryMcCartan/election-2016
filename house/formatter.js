let csv = require("fast-csv");
require("./states.js")(global);

let data = [];
csv.fromPath("data/results14.csv", {headers: true})
.on("data", d => data.push(d))
.on("end", () => {
    let districts = [];
    let curr = {
        incumbent: "N",
        dem: 0,
        gop: 0,
    };

    let prevDone = false;
    for (let row of data) {
        if (row.district === "" || prevDone) {
            if (curr.dem || curr.gop) districts.push(curr); // non-empty
            curr = {
                incumbent: "N",
                dem: 0,
                gop: 0,
            };
            if (!prevDone)
                continue;
            else
                prevDone = false;
        }
        
        if (row.district === "H") continue;

        curr.abbr = row.abbr;
        curr.district = +row.district;
        if (row.incumbent === "TRUE") curr.incumbent = row.party;

        if (row.total.toLowerCase().includes("district votes")) {
            if (!curr.total) 
                curr.total = +row.votes;
            prevDone = true;
        } else if (row.party === "D") {
            curr.dem += +row.votes;
            if (row.votes.toLowerCase() == "unopposed") {
                curr.dem = 1;
                curr.total = 1;
            }
        } else if (row.party === "R"){
            curr.gop += +row.votes;
            if (row.votes.toLowerCase() == "unopposed") {
                curr.gop = 1;
                curr.total = 1;
            }
        }
    }

    csv.writeToPath("data/2014.csv", districts, {headers: true});
});
