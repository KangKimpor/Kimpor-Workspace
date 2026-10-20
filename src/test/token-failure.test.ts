import {expect,test} from 'vitest'
import {tokenFailure} from '../../supabase/functions/kw-google/token-error'
test('only an invalid refresh grant requests sign-in; transient failures retain the connection',()=>{expect(tokenFailure('invalid_grant')).toBe('Reconnect this Google account');expect(tokenFailure('temporarily_unavailable')).toContain('temporarily unavailable');expect(tokenFailure(undefined)).toContain('temporarily unavailable')})
