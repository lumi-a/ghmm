from collections.abc import Sequence
from functools import partial
from random import random

import numpy as np
import numpy.typing as npt


def calculate_probability(
    T: npt.NDArray[np.float64],
    initial: npt.NDArray[np.float64],
    ws: Sequence[int],
    phi: npt.NDArray[np.float64] | None = None,
) -> float:
    """Returns the probability of seeing observations ws[0],ws[1],... in the GHHM given
    by T and the initial distribution.
    T has shape (observation, previous_state, next_state).
    If phi is None, assumes a standard HMM.
    """
    if phi is None:
        phi = np.ones(T.shape[1])
    return float(np.linalg.multi_dot([initial, *[T[w] for w in ws], phi]))


def predict(
    T: npt.NDArray[np.float64],
    initial: npt.NDArray[np.float64],
    ws: Sequence[int],
    phi: npt.NDArray[np.float64] | None = None,
) -> tuple[Sequence[float], Sequence[float]]:
    """Make predictions about the current state of the model and the next observation."""

    if phi is None:
        phi = np.ones(T.shape[1])

    unnormalised_belief_state = np.linalg.multi_dot([initial, *[T[w] for w in ws]])
    normalisation_factor = float(unnormalised_belief_state @ phi)
    belief_state = unnormalised_belief_state / normalisation_factor

    observation_prediction = [belief_state @ Tw @ phi for Tw in T]

    return belief_state, observation_prediction


p = random()
q = random()
xor_T = np.array(
    [
        [
            [0, 1 - p, 0, 0, 0],
            [0, 0, 0, 1 - q, 0],
            [0, 0, 0, 0, 1 - q],
            [1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
        ],
        [
            [0, 0, p, 0, 0],
            [0, 0, 0, 0, q],
            [0, 0, 0, q, 0],
            [0, 0, 0, 0, 0],
            [1, 0, 0, 0, 0],
        ],
    ]
)
xor_initial = np.array([1, 0, 0, 0, 0], dtype=np.float64)
run_xor = partial(calculate_probability, xor_T, xor_initial)

z1r_T = np.array(
    [[[0, 1, 0], [0, 0, 0], [0.5, 0, 0]], [[0, 0, 0], [0, 0, 1], [0.5, 0, 0]]]
)
z1r_initial = np.array([1 / 3, 1 / 3, 1 / 3])
predict_z1r = partial(predict, z1r_T, z1r_initial)


a = 0.2
x = 0.15
b = (1 - a) / 2
y = 1 - 2 * x
ay = a * y
bx = b * x
by = b * y
ax = a * x
mess4_T = np.array(
    [
        [
            [ay, bx, bx, bx],
            [ax, by, bx, bx],
            [ax, bx, by, bx],
            [ax, bx, bx, by],
        ],
        [
            [by, ax, bx, bx],
            [bx, ay, bx, bx],
            [bx, ax, by, bx],
            [bx, ax, bx, by],
        ],
        [
            [by, bx, ax, bx],
            [bx, by, ax, bx],
            [bx, bx, ay, bx],
            [bx, bx, ax, by],
        ],
        [
            [by, bx, bx, ax],
            [bx, by, bx, ax],
            [bx, bx, by, ax],
            [bx, bx, bx, ay],
        ],
    ]
)
mess4_initial = np.array([1 / 4, 1 / 4, 1 / 4, 1 / 4])
predict_mess4 = partial(predict, mess4_T, mess4_initial)

if __name__ == "__main__":
    for a in [0, 1]:
        for b in [0, 1]:
            expected = 1 if a != b else 0
            a_prob = p if a == 1 else 1 - p
            b_prob = q if b == 1 else 1 - q
            assert run_xor([a, b, expected]) == a_prob * b_prob, f"p={p}, q={q}"
            assert run_xor([a, b, 1 - expected]) == 0, f"p={p}, q={q}"

    assert predict_z1r([0])[0].tolist() == [1 / 3, 2 / 3, 0]
    assert predict_z1r([1])[0].tolist() == [1 / 3, 0, 2 / 3]
    assert predict_z1r([0, 0])[0].tolist() == [0, 1, 0]
    assert predict_z1r([0, 1])[0].tolist() == [0, 0, 1]
    assert predict_z1r([1, 0])[0].tolist() == [1 / 2, 1 / 2, 0]
    assert predict_z1r([1, 1])[0].tolist() == [1, 0, 0]

    print("Tests passed!")

    import itertools

    import plotly.graph_objects as go

    # Vertices of a regular tetrahedron in 3D — each row is one simplex corner
    tetrahedron = np.array(
        [
            [1, 1, 1],
            [1, -1, -1],
            [-1, 1, -1],
            [-1, -1, 1],
        ],
        dtype=float,
    )

    words = list(itertools.product([0, 1, 2, 3], repeat=6))
    belief_states = np.array([predict_mess4(list(w))[0] for w in words])
    # Project: each belief state is a convex combination of the tetrahedron vertices
    pts = belief_states @ tetrahedron

    traces: list[go.BaseTraceType] = [
        go.Scatter3d(
            x=pts[:, 0],
            y=pts[:, 1],
            z=pts[:, 2],
            mode="markers",
            marker=dict(size=2, opacity=0.5),
            name="belief states",
        )
    ]

    # Draw the tetrahedron edges for reference
    edges = [(0, 1), (0, 2), (0, 3), (1, 2), (1, 3), (2, 3)]
    for i, j in edges:
        v = tetrahedron[[i, j]]
        traces.append(
            go.Scatter3d(
                x=v[:, 0],
                y=v[:, 1],
                z=v[:, 2],
                mode="lines",
                line=dict(color="grey", width=2),
                showlegend=False,
            )
        )

    # Label the simplex corners
    labels = [f"State {k}" for k in range(4)]
    traces.append(
        go.Scatter3d(
            x=tetrahedron[:, 0],
            y=tetrahedron[:, 1],
            z=tetrahedron[:, 2],
            mode="text",
            text=labels,
            textposition="top center",
            showlegend=False,
        )
    )

    fig = go.Figure(data=traces)
    fig.update_layout(title="Belief states (3-simplex projection)")
    fig.show()
