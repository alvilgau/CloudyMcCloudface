module Main exposing (..)

import Graph exposing (..)


main =
    viewGraph
        [ { keyword = "trump", color = "red" }, { keyword = "clinton", color = "blue" } ]
        [ { keyword = "trump", time = 1493985180, y = 1 }
        , { keyword = "trump", time = 1494000180, y = 10 }
        , { keyword = "trump", time = 1494015180, y = 3 }
        , { keyword = "clinton", time = 1493985180, y = 1 }
        , { keyword = "clinton", time = 1494000180, y = 3 }
        , { keyword = "clinton", time = 1494015180, y = 7 }
        ]
