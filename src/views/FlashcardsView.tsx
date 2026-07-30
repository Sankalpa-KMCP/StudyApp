import { useState } from 'react'
import { NotebookText } from 'lucide-react'
import type { Flashcard, StudySubject, FlashcardStatus } from '../db/types'
import { createId, nowIso, studyDb } from '../db/studyDb'
import { isFlashcardDue, formatFlashcardDue, nextFlashcardSchedule } from '../appUtils'
import { PanelHeader, TextInput, SubjectSelect, EditorActions, RowActionButtons, EmptyState } from '../components/ui'

async function reviewCard(card: Flashcard, status: FlashcardStatus) {
  const reviewedAt = nowIso()
  await studyDb.flashcards.update(card.id, { status, lastReviewedAt: reviewedAt, updatedAt: reviewedAt, ...nextFlashcardSchedule(card, status === 'remembered' ? 'remembered' : 'learning', new Date(reviewedAt)) })
}

export function FlashcardsView(props: {
  cards: Flashcard[]
  subjects: StudySubject[]
  subjectMap: Map<string, StudySubject>
  revealedCards: Set<string>
  onToggleReveal: (id: string) => void
  search?: string
  onClearSearch?: () => void
}) {
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [draft, setDraft] = useState({ front: '', back: '', subjectId: '' })

  const openEditor = (card?: Flashcard) => {
    setEditingCardId(card?.id ?? 'new')
    setDraft({ front: card?.front ?? '', back: card?.back ?? '', subjectId: card?.subjectId ?? props.subjects[0]?.id ?? '' })
  }

  const saveCard = async () => {
    const front = draft.front.trim()
    const back = draft.back.trim()
    if (!front || !back) return
    const timestamp = nowIso()
    const payload = { front, back, subjectId: draft.subjectId, updatedAt: timestamp }
    if (editingCardId && editingCardId !== 'new') await studyDb.flashcards.update(editingCardId, payload)
    else await studyDb.flashcards.add({ id: createId('card'), ...payload, status: 'new', lastReviewedAt: '', dueAt: timestamp, intervalDays: 0, reviewCount: 0, createdAt: timestamp })
    setEditingCardId(null)
    setDraft({ front: '', back: '', subjectId: props.subjects[0]?.id ?? '' })
  }

  return (
    <section className="workspace-panel" aria-labelledby="flashcards-workspace-title">
      <PanelHeader title="Flashcards" description="Review what is due and keep recall moving." actionLabel="New card" onAction={() => openEditor()} />
      {editingCardId ? (
        <div className="editor-card">
          <TextInput label="Front" value={draft.front} onChange={(front) => setDraft({ ...draft, front })} />
          <TextInput label="Back" value={draft.back} onChange={(back) => setDraft({ ...draft, back })} />
          <SubjectSelect subjects={props.subjects} value={draft.subjectId} onChange={(subjectId) => setDraft({ ...draft, subjectId })} />
          <EditorActions onSave={() => void saveCard()} onCancel={() => setEditingCardId(null)} />
        </div>
      ) : null}
      {props.cards.length > 0 ? (
        <div className="card-grid">
          {props.cards.map((card) => (
            <article className="detail-card flashcard" key={card.id}>
              <span className={`status-badge ${card.status}`}>{card.status}</span>
              <h3>{card.front}</h3>
              <p>{props.revealedCards.has(card.id) ? card.back : 'Answer hidden'}</p>
              <span className="pill">{props.subjectMap.get(card.subjectId)?.name ?? 'General'}</span>
              <small className={isFlashcardDue(card) ? 'due-copy is-due' : 'due-copy'}>{formatFlashcardDue(card)} - reviewed {card.reviewCount ?? 0} times</small>
              <div className="button-row">
                <button className="secondary-command" type="button" onClick={() => props.onToggleReveal(card.id)}>
                  {props.revealedCards.has(card.id) ? 'Hide' : 'Reveal'}
                </button>
                <button className="secondary-command" type="button" onClick={() => void reviewCard(card, 'learning')}>Later</button>
                <button className="primary-command" type="button" onClick={() => void reviewCard(card, 'remembered')}>Remembered</button>
              </div>
              <RowActionButtons label={card.front} onEdit={() => openEditor(card)} onDelete={() => void studyDb.flashcards.delete(card.id)} />
            </article>
          ))}
        </div>
      ) : (props.search || '').trim().length > 0 ? (
        <EmptyState icon={NotebookText} title="No matches found" body="No flashcards match that search." actionLabel="Clear search" onAction={props.onClearSearch || (() => {})} />
      ) : (
        <EmptyState icon={NotebookText} title="No flashcards yet" body="Create prompt-and-answer cards, then review them from this queue." actionLabel="Create first card" onAction={() => openEditor()} />
      )}
    </section>
  )
}
