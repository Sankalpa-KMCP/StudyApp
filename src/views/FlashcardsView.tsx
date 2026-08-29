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

type FlashcardValidationField = 'front' | 'back'

const FLASHCARD_FRONT_ERROR_ID = 'flashcard-front-error'
const FLASHCARD_BACK_ERROR_ID = 'flashcard-back-error'

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
  const [validationField, setValidationField] = useState<FlashcardValidationField | null>(null)
  const [pendingCardId, setPendingCardId] = useState<string | null>(null)
  const [pendingCardKind, setPendingCardKind] = useState<'review' | 'delete' | null>(null)
  const frontFieldRef = useRef<HTMLInputElement | null>(null)
  const backFieldRef = useRef<HTMLInputElement | null>(null)
  const handledEditorRequest = useRef(0)
  const saveMutation = useMutationState()
  const rowMutation = useMutationState()
  const { clearFeedback: clearSaveFeedback, isPending: isSaving, phase: savePhase, message: saveMessage, run: runSave } = saveMutation
  const { clearFeedback: clearRowFeedback, isPending: isRowPending, phase: rowPhase, message: rowMessage, run: runRow } = rowMutation

  const noticePhase: MutationPhase = savePhase === 'success' || savePhase === 'error'
    ? savePhase
    : rowPhase === 'success' || rowPhase === 'error'
      ? rowPhase
      : 'idle'
  const noticeMessage = (savePhase === 'success' || savePhase === 'error' ? saveMessage : null)
    ?? (rowPhase === 'success' || rowPhase === 'error' ? rowMessage : null)

  const clearValidation = useCallback(() => {
    setValidationError(null)
    setValidationField(null)
  }, [])

  const openEditor = useCallback((card?: Flashcard) => {
    clearValidation()
    clearSaveFeedback()
    setEditingCardId(card?.id ?? 'new')
    setDraft({
      front: card?.front ?? '',
      back: card?.back ?? '',
      subjectId: card?.subjectId ?? props.subjects[0]?.id ?? '',
    })
  }, [clearSaveFeedback, clearValidation, props.subjects])

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
    clearValidation()
  }, [clearValidation, isSaving, props.subjects])

  const dismissNotice = () => {
    clearValidation()
    clearSaveFeedback()
    clearRowFeedback()
  }

  const saveCard = async () => {
    clearValidation()
    clearSaveFeedback()
    clearRowFeedback()

    const validated = validateFlashcardEditorDraft(draft)
    if (!validated.ok) {
      if (!draft.front.trim()) {
        setValidationField('front')
        setValidationError('Enter the front of the flashcard.')
        frontFieldRef.current?.focus()
      } else {
        setValidationField('back')
        setValidationError('Enter the back of the flashcard.')
        backFieldRef.current?.focus()
      }
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
        clearValidation()
      },
    })
  }

  const reviewCard = async (card: Flashcard, status: 'learning' | 'remembered') => {
    if (pendingCardId || isSaving || isRowPending) return

    clearValidation()
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

    clearValidation()
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
            clearValidation()
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
  const frontInvalid = validationField === 'front'
  const backInvalid = validationField === 'back'

  return (
    <section className="workspace-panel" aria-labelledby="flashcards-workspace-title">
      <PanelHeader title="Flashcards" description="Review what is due and keep recall moving." actionLabel="New card" onAction={() => openEditor()} />
      <MutationNotice phase={noticePhase} message={noticeMessage} onDismiss={dismissNotice} />
      {editingCardId ? (
        <div className="editor-card" aria-busy={isSaving || undefined}>
          <TextInput
            id="flashcard-front"
            label="Front"
            value={draft.front}
            inputRef={frontFieldRef}
            invalid={frontInvalid}
            describedBy={frontInvalid ? FLASHCARD_FRONT_ERROR_ID : undefined}
            onChange={(front) => setDraft({ ...draft, front })}
          />
          {frontInvalid ? (
            <p id={FLASHCARD_FRONT_ERROR_ID} className="settings-feedback error" role="alert">
              {validationError}
            </p>
          ) : null}
          <TextInput
            id="flashcard-back"
            label="Back"
            value={draft.back}
            inputRef={backFieldRef}
            invalid={backInvalid}
            describedBy={backInvalid ? FLASHCARD_BACK_ERROR_ID : undefined}
            onChange={(back) => setDraft({ ...draft, back })}
          />
          {backInvalid ? (
            <p id={FLASHCARD_BACK_ERROR_ID} className="settings-feedback error" role="alert">
              {validationError}
            </p>
          ) : null}
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
