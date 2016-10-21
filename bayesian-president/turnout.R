# 2016 PRESIDENTIAL ELECTION PREDICTIONS
# © 2016 Cory McCartan

getVAP = function() {
    pop = read.csv("data/population.csv")
    clean = data.frame(row.names=pop$GEO.display.label)

    clean$vap_2010 = pop$est72010sex0_age18plus
    clean$vap_2011 = pop$est72011sex0_age18plus
    clean$vap_2012 = pop$est72012sex0_age18plus
    clean$vap_2013 = pop$est72013sex0_age18plus
    clean$vap_2014 = pop$est72014sex0_age18plus
    clean$vap_2015 = pop$est72015sex0_age18plus

    pop = as.data.frame(t(clean))
    states = tail(names(pop), -1)
    pop$year = c(2010, 2011, 2012, 2013, 2014, 2015)

    models = lapply(states, function(state) {
        lm(
            substitute(s ~ log(year), list(s = as.name(state))), 
            data = pop
            )
    })
    state_vap = sapply(models, function(model) {
        as.integer( predict(model, data.frame(year = 2016)) )
    })

    nat_model = nls(US ~ SSlogis(year, x1, x2, x3), data = pop)
    nat_vap = predict(nat_model, data.frame(year = 2016))

    vaps = data.frame(row.names = row.names(clean))
    vaps$vap = c(nat_vap, state_vap)

    return(vaps)
}

getTurnout = function(current_gap, current_interest) {
	elec = read.csv("data/elections/all.csv")
	weights = exp((elec$year - 2012) / 40)
	gap = abs(elec$dem_pct - elec$gop_pct)
	model = lm(turnout ~ interest + gap, data = elec, weights=weights)
    percent = predict(model, data.frame(gap = current_gap, interest = current_interest))
    
    old_turnout = elec$turnout[elec$year == 2012]
    change = percent / old_turnout

	st = getStateTurnout()
	new_turnout = st$rate * change

    turnout = data.frame(row.names = st$state)
    turnout$state = st$state
    turnout$total = getVAP()$vap * new_turnout
    stateTotal = sum(turnout$total[turnout$state != "US"])
    # adjust so sums match
    turnout$total[turnout$state != "US"] = turnout$total[turnout$state != "US"] *
        (turnout["US", "total"] / stateTotal)
    turnout$rate = new_turnout

	return(turnout)
}

getStateTurnout = function() {
    st = read.csv("data/state-turnout.csv")
    total = read.csv("data/population.csv")$est72012sex0_age18plus
    row.names(st) = st$state
    st$rate = st$votes / total

    return(st)
}
