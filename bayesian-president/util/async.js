/* ASYNC UTILITY */

function run(generator) {
    var iterator = generator();
    var result;

    var iterate = function(value) {
        result = iterator.next(value); 

        if (!result.done) {
            // continue immediately, avoiding synchronous recursion
            if ("then" in result.value) { // is a promise
                result.value.then(iterate); // continue when done
            } else {
                setTimeout(iterate.bind(this, result.value), 0); 
            }
        }
    };

    iterate();
}

module.exports = {run};
