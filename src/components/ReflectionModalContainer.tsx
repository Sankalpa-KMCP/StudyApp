import { useStudyTimerControls } from '../context/studyTimerContext'
import { ReflectionModal } from './ReflectionModal'

interface ReflectionModalContainerProps {
  studyBlockDurationMinutes: number
}

export function ReflectionModalContainer({ studyBlockDurationMinutes }: ReflectionModalContainerProps) {
  const timer = useStudyTimerControls()

  return (
    <ReflectionModal
      key={timer.pendingSessionData?.timestamp ?? 'reflection'}
      showReflectionModal={timer.showReflectionModal}
      pendingSessionData={timer.pendingSessionData}
      studyBlockDurationMinutes={studyBlockDurationMinutes}
      attentionRating={timer.attentionRating}
      setAttentionRating={timer.setAttentionRating}
      stabilityRating={timer.stabilityRating}
      setStabilityRating={timer.setStabilityRating}
      localSessionNotes={timer.localSessionNotes}
      setLocalSessionNotes={timer.setLocalSessionNotes}
      onSubmitReflection={timer.submitReflection}
    />
  )
}
