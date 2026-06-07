import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db'
import { resetDatabase } from '../../test/dbTestUtils'
import { updateSetting, getInitialEasinessFactor } from '../repositories/settings'

describe('settings repository', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('updateSetting upserts a key', async () => {
    await updateSetting('theme', 'midnight-oled')
    const row = await db.settings.get('theme')
    expect(row?.value).toBe('midnight-oled')

    await updateSetting('theme', 'nordic-frost')
    expect((await db.settings.get('theme'))?.value).toBe('nordic-frost')
  })

  it('getInitialEasinessFactor returns default when missing', async () => {
    expect(await getInitialEasinessFactor()).toBe(2.5)
  })

  it('getInitialEasinessFactor returns stored value', async () => {
    await updateSetting('initialEasinessFactor', 2.8)
    expect(await getInitialEasinessFactor()).toBe(2.8)
  })
})
