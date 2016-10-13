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
    pop$year = c(2010, 2011, 2012, 2013, 2014, 2015)

    vap_model = nls(US ~ SSlogis(year, x1, x2, x3), data = pop)
    VAP = predict(vap_model, data.frame(year = 2016))

    return(as.integer(VAP))
}

getTurnout = function(current_gap) {
	elec = read.csv("data/elections/all.csv")
	weights = exp((elec$year - 2012) / 20)
	gap = abs(elec$dem_pct - elec$gop_pct)
	model = lm(turnout ~ gap + relec, data = elec, weights = weights)
	percent = predict(model, data.frame(gap = current_gap, relec = FALSE)) / 100 
	VAP = getVAP()

	return(VAP * percent)
}
