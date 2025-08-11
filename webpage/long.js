// this does literally nothing more than force long into global scope,
// we do this because if we dont, default values wont use Long and instead use js number
import Long from 'long'
window.Long = Long;