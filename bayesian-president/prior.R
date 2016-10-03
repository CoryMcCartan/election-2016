# 2016 PRESIDENTIAL ELECTION PREDICTIONS
# © 2016 Cory McCartan

initPriors = function() {
    estBetaParams = function(mu, var) {
        alpha = ((1 - mu) / var - 1 / mu) * mu ^ 2
        beta = alpha * (1 / mu - 1)
        return(params = list(alpha = alpha, beta = beta))
    }

    d2004 = read.csv("data/elections/2004.csv")
    d2008 = read.csv("data/elections/2008.csv")
    d2012 = read.csv("data/elections/2012.csv")
    # Weighted average of proportion in each state
    mean = (d2004$dem/d2004$total) * (3/6) +
        (d2008$dem/d2008$total) * (2/6) +
        (d2012$dem/d2012$total) * (1/6)

    # gues s.d. for each state. mean*(1-mean) gives 0.25 max, so we have
    # 10% s.d. at 50/50 and 35% s.d. at 0/100
    sd = 0.35 - mean * (1 - mean)
    var = sd*sd

    params = estBetaParams(mean, var)

    return(params)
}
