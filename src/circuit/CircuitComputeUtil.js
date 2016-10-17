import {CircuitEvalContext} from "src/circuit/CircuitEvalContext.js"
import {CircuitShaders} from "src/circuit/CircuitShaders.js"
import {KetTextureUtil} from "src/circuit/KetTextureUtil.js"
import {Controls} from "src/circuit/Controls.js"
import {Gate} from "src/circuit/Gate.js"
import {Gates} from "src/gates/AllGates.js"
import {Point} from "src/math/Point.js"
import {Util} from "src/base/Util.js"
import {seq, Seq} from "src/base/Seq.js"
import {notifyAboutRecoveryFromUnexpectedError} from "src/fallback.js"
import {WglTexturePool} from "src/webgl/WglTexturePool.js"
import {WglTextureTrader} from "src/webgl/WglTextureTrader.js"

/**
 * @param {!CircuitDefinition} circuitDefinition
 * @param {!string=""} symbol
 * @param {!string=""} name
 * @param {!string=""} blurb
 * @returns {!Gate}
 */
function circuitDefinitionToGate(circuitDefinition, symbol="", name="", blurb="") {
    return Gate.withoutKnownMatrix(symbol, name, blurb).
        withKnownCircuit(circuitDefinition).
        withStableDuration(circuitDefinition.stableDuration()).
        withCustomOperation(ctx => advanceStateWithCircuit(
            ctx,
            circuitDefinition.withDisabledReasonsForEmbeddedContext(ctx.row, ctx.customContextFromGates),
            false)).
        withHeight(circuitDefinition.numWires).
        withCustomDisableReasonFinder(args => {
            let def = circuitDefinition.withDisabledReasonsForEmbeddedContext(args.outerRow, args.context);
            for (let row = 0; row < def.numWires; row++) {
                for (let col = 0; col < def.columns.length; col++) {
                    let r = def.gateAtLocIsDisabledReason(col, row);
                    if (r !== undefined) {
                        return r;
                    }
                    if (def.gateInSlot(col, row) === Gates.Special.Measurement) {
                        return "hidden\nmeasure\nbroken";
                    }
                }
            }
            return undefined;
        });
}

/**
 * @param {!CircuitEvalContext} ctx
 * @param {!CircuitDefinition} circuitDefinition
 * @param {!boolean} collectStats
 * @returns {!{output:!WglTexture, colQubitDensities:!Array.<!WglTexture>,customStats:!Array, customStatsMap:!Array}}
 */
function advanceStateWithCircuit(ctx, circuitDefinition, collectStats) {
    // Prep stats collection.
    let colQubitDensities = [];
    let customStats = [];
    let customStatsMap = [];
    let statsCallback = col => statArgs => {
        if (!collectStats) {
            return;
        }

        let {qubitDensities, customGateStats} = _extractStateStatsNeededByCircuitColumn(
            statArgs,
            circuitDefinition,
            col);
        colQubitDensities.push(qubitDensities);
        for (let {row, stat} of customGateStats) {
            //noinspection JSUnusedAssignment
            customStatsMap.push({col, row, out: customStats.length});
            //noinspection JSUnusedAssignment
            customStats.push(stat);
        }
    };

    // Apply each column in the circuit.
    for (let col = 0; col < circuitDefinition.columns.length; col++) {
        _advanceStateWithCircuitDefinitionColumn(
            ctx,
            circuitDefinition,
            col,
            statsCallback(col));
    }

    if (collectStats) {
        const allWiresMask = (1 << circuitDefinition.numWires) - 1;
        colQubitDensities.push(KetTextureUtil.superpositionToQubitDensities(
            ctx.stateTrader.currentTexture, Controls.NONE, allWiresMask));
    }

    return {
        output: ctx.stateTrader.currentTexture,
        colQubitDensities,
        customStats,
        customStatsMap
    };
}

/**
 * @param {!CircuitEvalContext} ctx
 * @param {!CircuitDefinition} circuitDefinition
 * @param {!int} col
 * @private
 * @returns {!{qubitDensities:!WglTexture, customGateStats:!Array.<!{row:!int,stat:!WglTexture}>}}
 */
function _extractStateStatsNeededByCircuitColumn(
        ctx,
        circuitDefinition,
        col) {
    // Compute custom stats used by display gates.
    let customGateStats = [];
    for (let row of circuitDefinition.customStatRowsInCol(col)) {
        let statCtx = new CircuitEvalContext(
            ctx.time,
            row,
            circuitDefinition.numWires,
            ctx.controls,
            ctx.controlsTexture,
            ctx.stateTrader,
            circuitDefinition.colCustomContextFromGates(col, row));
        let stat = circuitDefinition.columns[col].gates[row].customStatTexturesMaker(statCtx);
        customGateStats.push({row, stat});
    }

    // Compute individual qubit densities, where needed.
    let qubitDensities = KetTextureUtil.superpositionToQubitDensities(
        ctx.stateTrader.currentTexture,
        ctx.controls,
        circuitDefinition.colHasSingleQubitDisplayMask(col));

    return {qubitDensities, customGateStats};
}

/**
 * Advances the state trader inside of the given CircuitEvalContext.
 *
 * @param {!CircuitEvalContext} ctx Evaluation arguments, including the row this column starts at (for when the circuit
 *                                  we're applying is actually a gate embedded inside an outer circuit).
 * @param {!CircuitDefinition} circuitDefinition
 * @param {!int} col
 * @param {!function(!CircuitEvalContext)} statsCallback
 * @returns {void}
 * @private
 */
function _advanceStateWithCircuitDefinitionColumn(
        ctx,
        circuitDefinition,
        col,
        statsCallback) {

    let controls = ctx.controls.and(circuitDefinition.colControls(col).shift(ctx.row));
    let controlTex = CircuitShaders.controlMask(controls).toBoolTexture(ctx.wireCount);

    let colContext = Util.mergeMaps(
        ctx.customContextFromGates,
        circuitDefinition.colCustomContextFromGates(col, ctx.row));

    let trader = ctx.stateTrader;
    let aroundCtx = new CircuitEvalContext(
        ctx.time,
        ctx.row,
        ctx.wireCount,
        ctx.controls,
        ctx.controlsTexture,
        trader,
        colContext);
    let mainCtx = new CircuitEvalContext(
        ctx.time,
        ctx.row,
        ctx.wireCount,
        controls,
        controlTex,
        trader,
        colContext);

    circuitDefinition.applyBeforeOperationsInCol(col, aroundCtx);
    circuitDefinition.applyMainOperationsInCol(col, mainCtx);
    statsCallback(mainCtx);
    circuitDefinition.applyAfterOperationsInCol(col, aroundCtx);

    controlTex.deallocByDepositingInPool("controlTex in _advanceStateWithCircuitDefinitionColumn");
}

export {circuitDefinitionToGate, advanceStateWithCircuit}
