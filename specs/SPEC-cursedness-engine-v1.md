SPEC-cursedness-engine-v1

Input rating: integer 1–100, one per (session_id, media_id).

Per-media aggregates:
n, sum, sum_sq.

Bayesian mean:
mu0=50, k=12
bayes = (mu0*k + sum) / (k + n)

Confidence:
confidence = 1 - exp(-n/12)

Stddev:
std = sqrt((sum_sq/n) - mean^2)

Variance penalty:
normalized = clamp(std/40,0,1)
penalty = normalized * 8

Final score:
score = clamp(bayes - penalty, 0..100)

Graveyard:
if confidence>=0.8 AND score<=18 => status='graveyard'

Depth eligibility (D = 0..100):
minScore(D) = 10 + 0.75*D
minConf(D)  = 0.2 + 0.006*D
eligible if score>=minScore AND confidence>=minConf

END.