module Keyword exposing (Keyword, zipWithColor)


type alias Keyword =
    { name : String
    , color : String
    }


colors : List String
colors =
    [ "rgb(57,106,177)", "rgb(218,124,48)", "rgb(62,150,81)", "rgb(204,37,41)", "rgb(83,81,84)" ]


zipWithColor : List Keyword -> List Keyword
zipWithColor keywords =
    keywords
        |> List.map .name
        |> List.map2 (\c k -> { name = k, color = c }) colors
