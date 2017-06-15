module Model exposing (..)

import Keyword exposing (Keyword)
import DataPoint exposing (DataPoint)
import Tenant exposing (Tenant)
import Time exposing (Time)
import Recording exposing (Recording)
import Navigation exposing (Location)


type Modus
    = Live
    | Tape


type alias Origin =
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
    , origin : Origin
    , recordings : Maybe (List Recording)
    , selectedRecording : Maybe String
    , editedRecording : Maybe Recording
    , error : Maybe String
    }
