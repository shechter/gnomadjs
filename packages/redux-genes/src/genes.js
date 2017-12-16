/* eslint-disable space-before-function-paren */
/* eslint-disable no-shadow */
/* eslint-disable comma-dangle */
/* eslint-disable import/no-unresolved */

/* eslint-disable import/extensions */

import Immutable from 'immutable'
import keymirror from 'keymirror'
import { createSelector } from 'reselect'

import { createRecords } from './records'

export const types = keymirror({
  REQUEST_GENE_DATA: null,
  RECEIVE_GENE_DATA: null,
  SET_CURRENT_GENE: null,
  SET_CURRENT_TISSUE: null,
  SET_CURRENT_TRANSCRIPT: null,
  TOGGLE_TRANSCRIPT_FAN_OUT: null,
  SET_CURRENT_EXON: null,
  SET_EXON_PADDING: null,
  SET_CURRENT_CONSTRAINED_REGION: null
})

export const actions = {
  requestGeneData: geneName => ({
    type: types.REQUEST_GENE_DATA,
    geneName,
  }),

  receiveGeneData: (geneName, geneData) => ({
    type: types.RECEIVE_GENE_DATA,
    geneName,
    geneData: Immutable.fromJS(geneData),
  }),

  fetchPageDataByGene (geneName, geneFetchFunction) {
    return (dispatch, getState) => {
      const state = getState()
      dispatch(actions.requestGeneData(geneName))
      geneFetchFunction(geneName)
        .then((geneData) => {
          dispatch(actions.receiveGeneData(geneName, geneData))
        })
    }
  },

  shouldFetchGene (state, currentGene) {
    const gene = state.genes.allGeneNames[currentGene]
    if (!gene) {
      return true
    }
    if (state.genes.isFetching) {
      return false
    }
    return false
  },

  fetchGeneIfNeeded (currentGene, match, geneFetchFunction) {
    if (match) {
      if (match.params.gene) {
        return (dispatch) => {
          dispatch(actions.setCurrentGene(match.params.gene))
        }
      }
    }
    return (dispatch, getState) => {  // eslint-disable-line
      if (actions.shouldFetchGene(getState(), currentGene)) {
        return dispatch(actions.fetchPageDataByGene(currentGene, geneFetchFunction))
      }
    }
  },
  toggleTranscriptFanOut: () => ({ type: types.TOGGLE_TRANSCRIPT_FAN_OUT }),
  setCurrentGene: geneName => ({ type: types.SET_CURRENT_GENE, geneName }),
  setCurrentTranscript: transcriptId => ({ type: types.SET_CURRENT_TRANSCRIPT, transcriptId }),
  setCurrentExon: exonId => ({ type: types.SET_CURRENT_EXON, exonId }),
  setExonPadding: padding => ({ type: types.SET_EXON_PADDING, padding }),
  setCurrentTissue: tissueName => ({ type: types.SET_CURRENT_TISSUE, tissueName }),
  setCurrentConstrainedRegion: constrainedRegionName =>
    ({ type: types.SET_CURRENT_CONSTRAINED_REGION, constrainedRegionName }),
}

export default function createGeneReducer(config) {
  const variantDatasetKeys = Object.keys(config.variantDatasets)
  const State = Immutable.Record({
    isFetching: false,
    byGeneName: Immutable.OrderedMap(),
    allGeneNames: Immutable.Set(),
    currentGene: config.startingGene,
    currentTissue: null,
    currentTranscript: null,
    transcriptFanOut: false,
    currentExon: null,
    currentConstrainedRegion: null,
    exonPadding: config.exonPadding || 75,
  })

  const actionHandlers = {
    [types.REQUEST_GENE_DATA] (state) {
      return state.set('isFetching', true)
    },
    [types.RECEIVE_GENE_DATA] (state, { geneName, geneData }) {
      const geneDataOnly = variantDatasetKeys.reduce((acc, variantDataKey) => {
        return acc.delete(variantDataKey)
      }, geneData)

      return (
        state
          .set('isFetching', false)
          .set('byGeneName', state.byGeneName.set(geneName, geneDataOnly))
          .set('allGeneNames', state.allGeneNames.add(geneName))
      )
    },
    [types.SET_CURRENT_TISSUE] (state, { tissueName }) {
      return state.set('currentTissue', tissueName)
    },
    [types.SET_CURRENT_GENE] (state, { geneName }) {
      return state.set('currentGene', geneName)
    },
    [types.SET_CURRENT_TRANSCRIPT] (state, { transcriptId }) {
      return state.set('currentTranscript', transcriptId)
    },
    [types.TOGGLE_TRANSCRIPT_FAN_OUT] (state) {
      return state.set('transcriptFanOut', !state.get('transcriptFanOut'))
    },
    [types.SET_CURRENT_EXON] (state, { exonId }) {
      return state.set('currentExon', exonId)
    },
    [types.SET_CURRENT_CONSTRAINED_REGION] (state, { constrainedRegionName }) {
      return state.set('currentConstrainedRegion', constrainedRegionName)
    },
  }

  function genes (state = new State(), action: Object): State {
    const { type } = action
    if (type in actionHandlers) {
      return actionHandlers[type](state, action)
    }
    return state
  }
  return genes
}

export const currentGene = state => state.genes.currentGene
export const byGeneName = state => state.genes.byGeneName
export const allGeneNames = state => state.genes.allGeneNames
export const isFetching = state => state.genes.isFetching
export const currentTissue = state => state.genes.currentTissue
export const currentTranscript = state => state.genes.currentTranscript
export const transcriptFanOut = state => state.genes.transcriptFanOut
export const currentExon = state => state.genes.currentExon
export const exonPadding = state => state.genes.exonPadding

export const geneData = createSelector(
  [byGeneName, currentGene],
  (byGeneName, currentGene) => byGeneName.get(currentGene),
)

export const transcripts = createSelector(
  [geneData],
  geneData => geneData.get('transcripts').toJS()
)
export const transcriptsGrouped = createSelector(
  [transcripts],
  (transcripts) => {
    return transcripts.reduce((acc, transcript) => {
      return {
        ...acc,
        [transcript.transcript_id]: transcript,
      }
    }, {})
  }
)

export const tissueStats = createSelector(
  [transcripts],
  (transcripts) => {
    const maxValuesForTissue = transcripts[0].gtex_tissue_tpms_by_transcript
    const tissues = Object.keys(maxValuesForTissue)
    transcripts.forEach((transcript) => {
      tissues.forEach((tissue) => {
        const nextValue = transcript.gtex_tissue_tpms_by_transcript[tissue]
        if (nextValue > maxValuesForTissue[tissue]) {
          maxValuesForTissue[tissue] = nextValue
        }
      })
    })
    return Immutable.Map(maxValuesForTissue).sort().reverse()
  }
)

export const regionalConstraint = createSelector(
  [geneData],
  geneData => geneData.get('exacv1_regional_constraint_regions').toJS()
)