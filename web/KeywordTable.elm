module KeywordTable exposing (view)

import Html exposing (Html, button, text, tr, td, table, th, thead, tbody, input, b)
import Html.Attributes exposing (style, type_, class, placeholder)
import Html.Events exposing (onClick, onInput)
import Svg
import Svg.Attributes as SvgAttr
import Keyword exposing (Keyword)
import Msg exposing (..)


view : Bool -> String -> List Keyword -> Html Msg
view static editedKeyword keywords =
    table [ class "u-full-width" ] [ keywordHeading static, (keywordRows static editedKeyword keywords) ]


keywordHeading : Bool -> Html msg
keywordHeading static =
    thead []
        [ tr []
            ([ th [] [ text "Keyword" ]
             , th [] [ text "Color" ]
             ]
                |> appendIf (not static) [ th [] [ text "Action" ] ]
            )
        ]


keywordRows : Bool -> String -> List Keyword -> Html Msg
keywordRows static editedKeyword keywords =
    let
        rows =
            (List.map (keywordRow static) keywords)
                |> appendIf (not static) [ inputRow editedKeyword ]
                |> List.take 5
    in
        tbody [] rows


keywordRow : Bool -> Keyword -> Html Msg
keywordRow static keyword =
    tr []
        ([ td [] [ text keyword.name ]
         , td [] [ coloredCircle keyword.color ]
         ]
            |> appendIf (not static) [ td [] [ button [ style [ ( "padding", "0 15px" ) ], onClick (Remove keyword.name) ] [ text "x" ] ] ]
        )


appendIf : Bool -> appendable -> appendable -> appendable
appendIf condition other list =
    if condition then
        list ++ other
    else
        list


inputRow : String -> Html Msg
inputRow editedKeyword =
    tr []
        [ td [] [ input [ type_ "text", placeholder "New keyword", onInput KeywordEdited ] [] ]
        , td [] [ coloredCircle "rgba(0,0,0,0)" ]
        , td [] [ button [ type_ "submit", class "button-primary", style [ ( "padding", "0 15px" ) ], onClick (Add editedKeyword) ] [ b [] [ text "+" ] ] ]
        ]


coloredCircle : String -> Html msg
coloredCircle color =
    Svg.svg [ SvgAttr.width "20", SvgAttr.height "20" ] [ Svg.circle [ SvgAttr.cx "10", SvgAttr.cy "10", SvgAttr.r "10", SvgAttr.fill color ] [] ]
