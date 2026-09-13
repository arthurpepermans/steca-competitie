import unittest
from bs4 import BeautifulSoup
from sync_vrouwen import rankings, score

class TwizzitTests(unittest.TestCase):
    def test_score_neemt_geen_ander_duel(self):
        soup=BeautifulSoup('<div class="score-wrapper d-flex"><span class="score">-</span></div><a class="game"><span class="score">3-1</span></a>','html.parser')
        self.assertIsNone(score(soup))
    def test_nul_is_een_uitslag(self):
        soup=BeautifulSoup('<div class="score-wrapper d-flex"><span class="score">0 - 0</span></div>','html.parser')
        self.assertEqual(score(soup),[0,0])
    def test_kolomvolgorde_en_lege_bron(self):
        soup=BeautifulSoup('<a href="#ranking-1">Reeks</a><div id="ranking-1"><table class="ranking-table"><tbody><tr>'+''.join(f'<td>{x}</td>' for x in [1,'STECA VROUWEN',3,1,2,0,5,7,-2,3])+'</tr></tbody></table></div>','html.parser')
        row=rankings(soup)[0]['rijen'][0]
        self.assertEqual((row['winst'],row['verlies'],row['gelijk'],row['punten']),(1,2,0,3))
        with self.assertRaises(ValueError): rankings(BeautifulSoup('<h1>Login</h1>','html.parser'))
if __name__=='__main__': unittest.main()
