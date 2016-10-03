data {
    int<lower=0> N; // polls
    real prior_a[51];
    real prior_b[51];

    real dem_vote[51];
    real gop_vote[51];
}
parameters {
    real state_mu[51];
    real state_var[51];
}
model {
    for (i in 1:51) {
        state_mu[i] ~ beta(prior_a[i], prior_b[i])
        state_var[i] ~ cauchy(0, 0.1)
        dem_vote[i] ~ normal(state_mu[i], state_var[i])
    }
}
