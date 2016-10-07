# 2016 PRESIDENTIAL ELECTION PREDICTIONS
# © 2016 Cory McCartan

library("plyr")

polls = read.csv("data/polls.csv")

dates = as.Date(polls$date, "%a %b %d %Y")
recency.weights = exp(0.5 * as.integer(dates - Sys.Date()))
# add in recency weights, and weight polls with 3rd party candidates more
polls$weight = recency.weights * polls$weight * (1 + (polls$lib != -1))

averages = ddply(polls, .(state), 
               function(x) data.frame(
                   dem = weighted.mean(x$dem, x$weight),
                   gop = weighted.mean(x$gop, x$weight),
                   lib = weighted.mean(x$lib[x$lib != -1], x$weight[x$lib != -1]))
               )

US = averages$state == "US"

averages$dem.win = averages$dem > averages$gop

dem = averages$dem[US] * 100
gop = averages$gop[US] * 100
lib = averages$lib[US] * 100

total = dem + gop + lib
exp_total = 100 - 1.5 # 1.5% "other"

dem = dem * (exp_total / total)
gop = gop * (exp_total / total)
lib = lib * (exp_total / total)

print(dem)
print(gop)
print(lib)
