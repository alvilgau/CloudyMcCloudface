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
        (field "timestamp" float)
        ((field "values" mean))


type alias Inner =
    { name : String
    , value : Float
    }


inner : Decoder (List Inner)
inner =
    list <|
        map2 Inner
            (field "name" string)
            (field "value" float)


mean : Decoder Float
mean =
    map
        getMean
        inner


getMean =
    List.filter (\i -> i.name == "Mean")
        >> List.map .value
        >> List.head
        >> Maybe.withDefault 0
