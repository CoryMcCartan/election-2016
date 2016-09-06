/*
 * JS LIBRARY
 * CORY McCARTAN
 * MARCH 2016
 */

(function() {
    "use strict";

    // call main()
    document.addEventListener("readystatechange", function() {
        if (document.readyState !== "complete") return;

        if (main.constructor.name === "GeneratorFunction") {
            runAsyncFunction(main);
        } else {
            main();
        }
    });

    // DOM getters
    window.$ = (s) => document.querySelector(s);
    window.$$ = (s) => document.querySelectorAll(s);

    // utility functions
    window.NULLF = () => {};
    window.LOGF = (l) => console.log(l);

    // yield for async/await stuff
    var runAsyncFunction = function(generator) {
        var iterator = generator();
        var result;

        var iterate = function(value) {
            result = iterator.next(value); 

            if (!result.done) {
                if ("then" in result.value) { // is a promise
                    result.value.then(iterate); // continue when done
                } else {
                    // continue immediately, avoiding synchronous recursion
                    setTimeout(iterate.bind(this, result.value), 0); 
                }
            }
        };
        
        iterate();
    };

    window.Mediator = function(glue) {
        var self = {};

        self.trigger = function(name, ...data) {   
            var functionName = "on" + name;

            if (glue.hasOwnProperty(functionName) 
                && typeof glue[functionName] === "function") {
                    glue[functionName](...data);
                }
        };

        return self;
    };
})();
