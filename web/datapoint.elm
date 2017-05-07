module DataPoint exposing (..)

import Json.Decode exposing (..)


type alias DataPoint =
    { keyword : String
    , time : Float
    , value : Float
    }


decode : Decoder DataPoint
decode =
    map3 DataPoint
        (field "keyword" string)
        (field "time" float)
        (field "value" float)
