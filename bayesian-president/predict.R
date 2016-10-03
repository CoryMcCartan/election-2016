# 2016 PRESIDENTIAL ELECTION PREDICTIONS
# © 2016 Cory McCartan

source("prior.R")
priors = initPriors()

polls = read.csv("data/polls.csv")

indexes = which(states == polls$state)
print(indexes)
n = aggregate(polls, list(polls$state), sum)$n
dem = aggregate(polls, list(polls$state), mean)$dem

post_a = priors$alpha + dem*n
post_b = priors$beta + n - dem*n

# update priors with polling
# simulate election (monte carlo)
