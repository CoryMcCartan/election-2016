/*
 * Calculate Electoral College
 */

"use strict";

const DEM = 0, GOP = 1;
const electors = {
    AL: 9,
    AK: 3,
    AZ: 11,
    AR: 6,
    CA: 55,
    CO: 9,
    CT: 7,
    DC: 3,
    DE: 3,
    FL: 29,
    GA: 16,
    HI: 4,
    ID: 4,
    IL: 20,
    IN: 11,
    IA: 6,
    KS: 6,
    KY: 8,
    LA: 8,
    ME: 4,
    MD: 10,
    MA: 11,
    MI: 16,
    MN: 10,
    MS: 6,
    MO: 10,
    MT: 3,
    NE: 5,
    NV: 6,
    NH: 4,
    NJ: 14,
    NM: 5,
    NY: 29,
    NC: 15,
    ND: 3,
    OH: 18,
    OK: 7,
    OR: 7,
    PA: 20,
    RI: 4,
    SC: 9,
    SD: 3,
    TN: 11,
    TX: 38,
    UT: 6,
    VT: 3,
    VA: 13,
    WA: 12,
    WV: 5,
    WI: 10,
    WY: 3
};

// vote is an object of predicted popular vote share for the Democrat
let sumElectors = function(vote) {
    let sums = [0, 0];

    // for every 
    for (let state in vote) {
        if (!(state in electors)) debugger;

        if (vote[state][DEM] > vote[state][GOP]) 
            sums[DEM] += electors[state];
        else
            sums[GOP] += electors[state];
    };

    return sums;
};


module.exports = function(self) {
    self.sumElectors = sumElectors;
    self.electors = electors;
};
