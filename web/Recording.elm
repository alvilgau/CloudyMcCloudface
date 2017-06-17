module Recording exposing (..)

import Json.Decode exposing (..)
import Date exposing (Date)
import DateTimePicker


type alias Recording =
    { id : String
    , begin : Date
    , end : Date
    , keywords : List String
    }


type Field
    = ID String
    | Begin Date
    | End Date
    | Keywords (List String)


init =
    { id = ""
    , begin = Date.fromTime 0
    , end = Date.fromTime 0
    , keywords = []
    }


set : Field -> Recording -> Recording
set field recording =
    case field of
        ID id ->
            { recording | id = id }

        Begin begin ->
            { recording | begin = begin }

        End end ->
            { recording | end = end }

        Keywords keywords ->
            { recording | keywords = keywords }


decode : Decoder Recording
decode =
    map4 Recording
        (field "id" string)
        (map Date.fromTime (field "begin" float))
        (map Date.fromTime (field "end" float))
        (field "keywords" (list string))
