module Model exposing (..)

import Keyword exposing (Keyword)
import DataPoint exposing (DataPoint)
import Tenant exposing (Tenant)
import Time exposing (Time)
import Recording exposing (Recording)
import CreateRecordingPageModel exposing (CreateRecordingPageModel)


type Modus
    = Live
    | Tape


type alias BaseUrl =
    { http : String
    , ws : String
    }


type alias Model =
    { keywords : List Keyword
    , data : List DataPoint
    , editedKeyword : String
    , tenant : Tenant
    , lastQuery : Time
    , modus : Maybe Modus
    , baseUrl : BaseUrl
    , recordings : Maybe (List Recording)
    , selectedRecording : Maybe String
    , createRecordingPageModel : Maybe CreateRecordingPageModel
    , error : Maybe String
    }
