import {Gate} from "src/circuit/Gate.js"
import {Matrix} from "src/math/Matrix.js"

let QuarterTurnGates = {};

/** @type {!Gate} */
QuarterTurnGates.SqrtXForward = Gate.fromKnownMatrix(
    "X^½",
    Matrix.fromPauliRotation(0.25, 0, 0),
    "√X Gate",
    "Principle square root of Not.");

/** @type {!Gate} */
QuarterTurnGates.SqrtXBackward = Gate.fromKnownMatrix(
    "X^-½",
    Matrix.fromPauliRotation(0.75, 0, 0),
    "X^-½ Gate",
    "Adjoint square root of Not.");

/** @type {!Gate} */
QuarterTurnGates.SqrtYForward = Gate.fromKnownMatrix(
    "Y^½",
    Matrix.fromPauliRotation(0, 0.25, 0),
    "√Y Gate",
    "Principle square root of Y.");

/** @type {!Gate} */
QuarterTurnGates.SqrtYBackward = Gate.fromKnownMatrix(
    "Y^-½",
    Matrix.fromPauliRotation(0, 0.75, 0),
    "Y^-½ Gate",
    "Adjoint square root of Y.");

/** @type {!Gate} */
QuarterTurnGates.SqrtZForward = Gate.fromKnownMatrix(
    "Z^½",
    Matrix.fromPauliRotation(0, 0, 0.25),
    "√Z Gate",
    "Principle square root of Z.\nAlso known as the 'S' gate.");

/** @type {!Gate} */
QuarterTurnGates.SqrtZBackward = Gate.fromKnownMatrix(
    "Z^-½",
    Matrix.fromPauliRotation(0, 0, 0.75),
    "Z^-½ Gate",
    "Adjoint square root of Z.");

QuarterTurnGates.all = [
    QuarterTurnGates.SqrtXForward,
    QuarterTurnGates.SqrtYForward,
    QuarterTurnGates.SqrtZForward,
    QuarterTurnGates.SqrtXBackward,
    QuarterTurnGates.SqrtYBackward,
    QuarterTurnGates.SqrtZBackward
];

export {QuarterTurnGates}
