import { useCallback, useEffect, useRef, useState } from 'react'
import { NotebookText } from '../components/icons'
import type { Flashcard, StudySubject } from '../db/types'
import {
  createFlashcard,
  deleteFlashcard,
  reviewFlashcard,
  updateFlashcard,
} from '../db/flashcardService'
import { isFlashcardDue, formatFlashcardDue } from '../appUtils'
import {
  PanelHeader,
  TextInput,
  SubjectSelect,
  EditorActions,
  RowActionButtons,
  EmptyState,
  MutationNotice,
} from '../components/ui'
import { useMutationState, type MutationPhase } from '../hooks/useMutationState'
import { validateFlashcardEditorDraft } from '../validation/editorDraftValidation'

type CardDraft = {
  front: string
  back: string
  subjectId: string
}

const emptyDraft = (subjectId = ''): CardDraft => ({
  front: '',
  back: '',
  subjectId,
})

export function FlashcardsView(props: {
  cards: Flashcard[]
  subjects: StudySubject[]
  subjectMap: Map<string, StudySubject>
  openEditorRequest?: number
  revealedCards: Set<string>
  onToggleReveal: (id: string) => void
  search?: string
  onClearSearch?: () => void
}) {
  const openEditorRequest = props.openEditorRequest ?? 0
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [draft, setDraft] = useState<CardDraft>(() => emptyDraft())
  const [validationError, setValidationError] = useState<string | null>(null)
  const [pendingCardId, setPendingCardId] = useState<string | null>(null)
  const [pendingCardKind, setPendingCardKind] = useState<'review' | 'delete' | null>(null)
  const handledEditorRequest = useRef(0)
  const saveMutation = useMutationState()
  const rowMutation = useMutationState()
  const { clearFeedback: clearSaveFeedback, isPending: isSaving, phase: savePhase, message: saveMessage, run: runSave } = saveMutation
  const { clearFeedback: clearRowFeedback, isPending: isRowPending, phase: rowPhase, message: rowMessage, run: runRow } = rowMutation

  const noticePhase: MutationPhase = validationError
    ? 'error'
    : savePhase === 'success' || savePhase === 'error'
      ? savePhase
      : rowPhase === 'success' || rowPhase === 'error'
        ? rowPhase
        : 'idle'
  const noticeMessage = validationError
    ?? (savePhase === 'success' || savePhase === 'error' ? saveMessage : null)
    ?? (rowPhase === 'success' || rowPhase === 'error' ? rowMessage : null)

  const openEditor = useCallback((card?: Flashcard) => {
    setValidationError(null)
    clearSaveFeedback()
    setEditingCardId(card?.id ?? 'new')
    setDraft({
      front: card?.front ?? '',
      back: card?.back ?? '',
      subjectId: card?.subjectId ?? props.subjects[0]?.id ?? '',
    })
  }, [clearSaveFeedback, props.subjects])

  useEffect(() => {
    if (openEditorRequest > handledEditorRequest.current) {
      handledEditorRequest.current = openEditorRequest
      openEditor()
    }
  }, [openEditor, openEditorRequest])

  const closeEditor = useCallback(() => {
    if (isSaving) return
    setEditingCardId(null)
    setDraft(emptyDraft(props.subjects[0]?.id ?? ''))
    setValidationError(null)
  }, [isSaving, props.subjects])

  const dismissNotice = () => {
    setValidationError(null)
    clearSaveFeedback()
    clearRowFeedback()
  }

  const saveCard = async () => {
    setValidationError(null)
    clearSaveFeedback()
    clearRowFeedback()

    const validated = validateFlashcardEditorDraft(draft)
    if (!validated.ok) {
      setValidationError('Enter both the front and back of the flashcard.')
      return
    }

    const isEdit = Boolean(editingCardId && editingCardId !== 'new')
    const fields = validated.fields

    await runSave(async () => {
      if (isEdit && editingCardId) {
        await updateFlashcard(editingCardId, fields)
        return
      }

      await createFlashcard(fields)
    }, {
      successMessage: isEdit ? 'Flashcard updated.' : 'Flashcard created.',
      errorMessage: 'Flashcard could not be saved. Your details are still in the form.',
      onSuccess: () => {
        setEditingCardId(null)
        setDraft(emptyDraft(props.subjects[0]?.id ?? ''))
        setValidationError(null)
      },
    })
  }

  const reviewCard = async (card: Flashcard, status: 'learning' | 'remembered') => {
    if (pendingCardId || isSaving || isRowPending) return

    setValidationError(null)
    clearSaveFeedback()
    clearRowFeedback()
    setPendingCardId(card.id)
    setPendingCardKind('review')

    const successMessage = status === 'remembered'
      ? 'Flashcard marked remembered.'
      : 'Flashcard marked for learning.'

    try {
      await runRow(async () => {
        await reviewFlashcard(card, status)
      }, {
        successMessage,
        errorMessage: 'Review could not be saved. The card has not been advanced.',
      })
    } finally {
      setPendingCardId(null)
      setPendingCardKind(null)
    }
  }

  const deleteCard = async (card: Flashcard) => {
    if (pendingCardId || isSaving || isRowPending) return

    setValidationError(null)
    clearSaveFeedback()
    clearRowFeedback()
    setPendingCardId(card.id)
    setPendingCardKind('delete')

    try {
      await runRow(async () => {
        await deleteFlashcard(card.id)
      }, {
        successMessage: 'Flashcard deleted.',
        errorMessage: 'Flashcard could not be deleted.',
        onSuccess: () => {
          if (editingCardId === card.id) {
            setEditingCardId(null)
            setDraft(emptyDraft(props.subjects[0]?.id ?? ''))
            setValidationError(null)
          }
        },
      })
    } finally {
      setPendingCardId(null)
      setPendingCardKind(null)
    }
  }

  const loadingLabel = editingCardId && editingCardId !== 'new' ? 'Saving flashcard...' : 'Creating flashcard...'
  const cardActionsLocked = isSaving || Boolean(pendingCardId)

  return (
    <section className="workspace-panel" aria-labelledby="flashcards-workspace-title">
      <PanelHeader title="Flashcards" description="Review what is due and keep recall moving." actionLabel="New card" onAction={() => openEditor()} />
      <MutationNotice phase={noticePhase} message={noticeMessage} onDismiss={dismissNotice} />
      {editingCardId ? (
        <div className="editor-card" aria-busy={isSaving || undefined}>
          <TextInput label="Front" value={draft.front} onChange={(front) => setDraft({ ...draft, front })} />
          <TextInput label="Back" value={draft.back} onChange={(back) => setDraft({ ...draft, back })} />
          <SubjectSelect subjects={props.subjects} value={draft.subjectId} onChange={(subjectId) => setDraft({ ...draft, subjectId })} />
          <EditorActions
            onSave={() => void saveCard()}
            onCancel={closeEditor}
            isLoading={isSaving}
            loadingLabel={loadingLabel}
          />
        </div>
      ) : null}
      {props.cards.length > 0 ? (
        <div className="card-grid">
          {props.cards.map((card) => {
            const isReviewing = pendingCardId === card.id && pendingCardKind === 'review'
            const isDeleting = pendingCardId === card.id && pendingCardKind === 'delete'

            return (
              <article className="detail-card flashcard" key={card.id}>
                <span className={`status-badge ${card.status}`}>{card.status}</span>
                <h3>{card.front}</h3>
                <p>{props.revealedCards.has(card.id) ? card.back : 'Answer hidden'}</p>
                <span className="pill">{props.subjectMap.get(card.subjectId)?.name ?? 'General'}</span>
                <small className={isFlashcardDue(card) ? 'due-copy is-due' : 'due-copy'}>{formatFlashcardDue(card)} - reviewed {card.reviewCount ?? 0} times</small>
                <div className="button-row">
                  <button
                    className="secondary-command"
                    type="button"
                    onClick={() => props.onToggleReveal(card.id)}
                    disabled={cardActionsLocked}
                  >
                    {props.revealedCards.has(card.id) ? 'Hide' : 'Reveal'}
                  </button>
                  <button
                    className="secondary-command"
                    type="button"
                    onClick={() => void reviewCard(card, 'learning')}
                    disabled={cardActionsLocked}
                    aria-busy={isReviewing || undefined}
                  >
                    {isReviewing ? 'Saving review...' : 'Later'}
                  </button>
                  <button
                    className="primary-command"
                    type="button"
                    onClick={() => void reviewCard(card, 'remembered')}
                    disabled={cardActionsLocked}
                    aria-busy={isReviewing || undefined}
                  >
                    {isReviewing ? 'Saving review...' : 'Remembered'}
                  </button>
                </div>
                <RowActionButtons
                  label={card.front}
                  onEdit={() => openEditor(card)}
                  onDelete={() => void deleteCard(card)}
                  isDisabled={cardActionsLocked}
                  isDeleting={isDeleting}
                />
              </article>
            )
          })}
        </div>
      ) : (props.search || '').trim().length > 0 ? (
        <EmptyState icon={NotebookText} title="No matches found" body="No flashcards match that search." actionLabel="Clear search" onAction={props.onClearSearch || (() => {})} />
      ) : (
        <EmptyState icon={NotebookText} title="No flashcards yet" body="Create prompt-and-answer cards, then review them from this queue." actionLabel="Create first card" onAction={() => openEditor()} />
      )}
    </section>
  )
}
