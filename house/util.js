function runAsyncFunction(generator) {
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

function sortByKey(arr, key) {
    return arr.sort((a, b) => {
        let x = a[key];
        let y = b[key];

        return (x < y) ? -1 : (x > y) ? 1 : 0;
    });
}

module.exports = {
    runAsyncFunction,
    sortByKey,
};
